package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.node.ObjectNode;

class ReadingImportBatchIntegrationTests extends ReadingImportTestSupport {
    @Test
    void changedMalformedFileUnderACommittedSubmissionUuidIsAConflict() throws Exception {
        var options = options(UUID.randomUUID());
        submit("import-owner", csv("21"), options).andExpect(status().isCreated());
        submit("import-owner", HEADER + "\"unterminated\n", options).andExpect(status().isConflict());
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void importedHistoryDoesNotFillSensorGapsOrChangeLiveMonitoringAndFailureRisk() throws Exception {
        var device = data.device(estate, location, asset, null);
        for (var time : java.util.List.of(TIME, "2026-10-01T00:05:00Z")) {
            db.execute(
                    "insert into \"DeviceReading\" (id, \"estateId\", \"assetId\", \"deviceId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, 'TEMPERATURE', 21, ?::timestamptz, now())",
                    UUID.randomUUID(),
                    estate,
                    asset,
                    device,
                    time);
        }
        var monitoringPath = "/estates/" + estate + "/flatlined-sensors?view=ALL";
        var riskPath = "/estates/" + estate + "/assets/" + asset + "/failure-risk";
        var monitoring = body(read(monitoringPath, "import-owner").andExpect(status().isOk()))
                .path("sensors");
        var risk = body(read(riskPath, "import-owner").andExpect(status().isOk()));
        var batch = importCsv(HEADER + row("21", "2026-10-01T00:04:00Z") + row("21", "2026-10-01T00:05:00Z"));
        read(readings() + "?flag=GAP", "import-owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].source").value("SENSOR"))
                .andExpect(jsonPath("$.items[0].flags[0].gapSeconds").value(300));
        assertThat(body(read(monitoringPath, "import-owner")).path("sensors")).isEqualTo(monitoring);
        assertThat(body(read(riskPath, "import-owner"))).isEqualTo(risk);
        revert(batch, "manager", "Historical batch only").andExpect(status().isOk());
        assertThat(body(read(monitoringPath, "import-owner")).path("sensors")).isEqualTo(monitoring);
        assertThat(body(read(riskPath, "import-owner"))).isEqualTo(risk);
    }

    @Test
    void separateAssetsAndMetricsAtTheSameInstantAreSeparateMeasurements() throws Exception {
        var secondAsset = data.asset(estate, location);
        var batch = importCsv(HEADER + row("21", TIME) + secondAsset + ",TEMPERATURE," + TIME + ",21\n" + asset
                + ",PRESSURE," + TIME + ",21\n");
        counts(batch, 3, 3, 0, 0, 0);
        assertThat(list().path("totalItems").asInt()).isEqualTo(3);
    }

    @Test
    void submissionUuidIsScopedToTheAuthenticatedUploader() throws Exception {
        var opts = options(UUID.randomUUID());
        var first = body(submit("import-owner", csv("21"), opts).andExpect(status().isCreated()));
        var second = body(submit("manager", csv("21"), opts).andExpect(status().isCreated()));
        assertThat(second.path("id")).isNotEqualTo(first.path("id"));
        counts(second, 1, 0, 1, 0, 0);
    }

    @Test
    void deduplicatesEquivalentOffsetsPrecisionAndDecimalsInRecordOrder() throws Exception {
        var batch = importCsv(HEADER
                + row("21.000000", "2026-10-01T08:00:00.123456789+08:00")
                + row("21", "2026-10-01T00:00:00.123456Z")
                + row("22", "2026-10-01T00:00:00.123456999Z"));
        counts(batch, 3, 1, 1, 1, 0);
        assertThat(rows(batch).path("items").get(2).path("issues").toString()).contains("READING_CONFLICT");
        assertThat(list().path("items").get(0).path("valueText").asText()).isEqualTo("21");
    }

    @Test
    void overlappingFilesAndDifferentVendorLabelsCannotOverwriteOrDuplicateReadings() throws Exception {
        importCsv(csv("21"));
        var opts = options(UUID.randomUUID());
        opts.put("sourceLabel", "Another vendor");
        var batch = body(submit(
                        "import-owner",
                        HEADER + row("21.000", TIME) + row("99", TIME) + row("22", "2026-10-02T00:00:00Z"),
                        opts)
                .andExpect(status().isCreated()));
        counts(batch, 3, 1, 1, 1, 0);
        assertThat(list().path("totalItems").asInt()).isEqualTo(2);
    }

    @Test
    void identicalSubmissionReturnsTheExistingBatchEvenWithMappingKeysReordered() throws Exception {
        var opts = options(UUID.randomUUID());
        var first = body(submit("import-owner", csv("21"), opts).andExpect(status().isCreated()));
        var mapping = opts.putObject("mapping");
        mapping.put("value", "value")
                .put("measured_at", "measured_at")
                .put("metric", "metric")
                .put("asset_id", "asset_id");
        var retry = body(submit("import-owner", csv("21"), opts).andExpect(status().isOk()));
        assertThat(retry.path("id")).isEqualTo(first.path("id"));
        read(imports(), "import-owner").andExpect(jsonPath("$.totalItems").value(1));
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"file", "source", "mapping"})
    void changingInputUnderAnExistingSubmissionUuidConflicts(String change) throws Exception {
        var opts = options(UUID.randomUUID());
        var file = csv("21") + row("22", "2026-10-02T00:00:00Z");
        // Both columns are valid mappings: a changed mapping must be a submission conflict.
        file = file.replace("value\n", "value,alternative\n")
                .replace(",21\n", ",21,23\n")
                .replace(",22\n", ",22,24\n");
        body(submit("import-owner", file, opts).andExpect(status().isCreated()));
        switch (change) {
            case "file" -> file = file + row("25", "2026-10-03T00:00:00Z").stripTrailing() + ",25\n";
            case "source" -> opts.put("sourceLabel", "Changed label");
            case "mapping" -> opts.withObject("/mapping").put("value", "alternative");
            default -> throw new IllegalArgumentException(change);
        }
        submit("import-owner", file, opts).andExpect(status().isConflict());
        assertThat(list().path("totalItems").asInt()).isEqualTo(2);
    }

    @Test
    void aNewSubmissionOfTheSameFileCreatesADuplicateOnlyReport() throws Exception {
        var first = importCsv(csv("21"));
        var second = importCsv(csv("21"));
        counts(second, 1, 0, 1, 0, 0);
        assertThat(second.path("id")).isNotEqualTo(first.path("id"));
        assertThat(rows(second).path("items").get(0).path("readingId"))
                .isEqualTo(rows(first).path("items").get(0).path("readingId"));
    }

    @Test
    void batchHistoryAndReportsRemainRetrievableAfterTheBrowserLosesTheResponse() throws Exception {
        var batch = importCsv(csv("21"));
        var saved = body(read(batchPath(batch), "manager").andExpect(status().isOk()));
        assertThat(saved.path("sourceLabel").asText()).isEqualTo(SOURCE);
        assertThat(saved.path("originalFilename").asText()).isEqualTo("vendor.csv");
        assertThat(saved.path("fileHash").asText()).isEqualTo(DeviceTestData.sha256Hex(csv("21")));
        assertThat(saved.path("uploaderUserId").asText()).isEqualTo("import-owner");
        assertThat(saved.path("mapping").isObject()).isTrue();
        assertThat(saved.path("parserVersion").asText()).isNotBlank();
        assertThat(rows(batch).path("totalItems").asInt()).isEqualTo(1);
        read(imports() + "?page=0&size=1", "manager")
                .andExpect(jsonPath("$.items[0].id").value(batch.path("id").asText()));
    }

    @Test
    void outcomeFiltersPaginateReportsAndCsvIncludesAllIssuesAndRecordLocations() throws Exception {
        var batch =
                importCsv(HEADER + row("21", TIME) + row("21", TIME) + UUID.randomUUID() + ",UNKNOWN,not-a-date,NaN\n");
        read(batchPath(batch) + "/rows?outcome=INVALID&page=0&size=1", "import-owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].recordNumber").value(4));
        var report = read(batchPath(batch) + "/report", "manager")
                .andExpect(status().isOk())
                .andReturn()
                .getResponse();
        assertThat(report.getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat(report.getHeader("Content-Disposition")).contains("attachment");
        assertThat(report.getContentType()).startsWith("text/csv");
        var records = csvRecords(report.getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(records.getFirst())
                .contains("recordNumber", "startingLineNumber", "outcome", "field", "code", "reason");
        assertThat(records).hasSizeGreaterThanOrEqualTo(7);
        assertThat(report.getContentAsString()).contains("ASSET_NOT_FOUND", "INVALID_TIMESTAMP");
    }

    @Test
    void rollbackDeletesOnlyItsInsertedReadingsAndRetainsOriginalOutcomesAndAudit() throws Exception {
        var first = importCsv(csv("21"));
        var second = importCsv(HEADER + row("21", TIME) + row("22", "2026-10-02T00:00:00Z"));
        var originalRows = rows(second).path("items").deepCopy();
        revert(second, "manager", "Wrong vendor extract").andExpect(status().isOk());
        var remaining = list();
        assertThat(remaining.path("totalItems").asInt()).isEqualTo(1);
        assertThat(remaining.path("items").get(0).path("importBatchId")).isEqualTo(first.path("id"));
        var reverted = body(read(batchPath(second), "import-owner").andExpect(status().isOk()));
        assertThat(reverted.path("status").asText()).isEqualTo("REVERTED");
        assertThat(reverted.path("removedCount").asInt()).isEqualTo(1);
        assertThat(reverted.path("rollbackReason").asText()).isEqualTo("Wrong vendor extract");
        assertThat(reverted.path("rollbackUserId").asText()).isEqualTo("manager");
        assertThat(reverted.path("rollbackAt").asText()).isNotBlank();
        assertThat(rows(second).path("items")).isEqualTo(originalRows);
        read(batchPath(second) + "/report", "import-owner").andExpect(status().isOk());
    }

    @Test
    void repeatedRollbackReturnsTheOriginalResultAndZeroInsertRollbackRemovesNothing() throws Exception {
        var first = importCsv(csv("21"));
        var duplicate = importCsv(csv("21"));
        var once = body(revert(duplicate, "manager", "Duplicate batch").andExpect(status().isOk()));
        var twice = body(revert(duplicate, "import-owner", "Another reason").andExpect(status().isOk()));
        assertThat(twice).isEqualTo(once);
        assertThat(list().path("items").get(0).path("importBatchId")).isEqualTo(first.path("id"));
        read(batchPath(duplicate), "import-owner")
                .andExpect(jsonPath("$.removedCount").value(0));
    }

    @Test
    void rollbackRequiresAReason() throws Exception {
        var batch = importCsv(csv("21"));
        revert(batch, "manager", " ").andExpect(status().isBadRequest());
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void retryingARevertedSubmissionDoesNotRestoreRowsButANewSubmissionCan() throws Exception {
        var opts = options(UUID.randomUUID());
        var first = body(submit("import-owner", csv("21"), opts).andExpect(status().isCreated()));
        revert(first, "import-owner", "Incorrect source").andExpect(status().isOk());
        submit("import-owner", csv("21"), opts)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REVERTED"));
        assertThat(list().path("totalItems").asInt()).isZero();
        counts(importCsv(csv("21")), 1, 1, 0, 0, 0);
    }

    @Test
    void importAndRollbackPreserveExistingSensorManualAndAssessmentHistory() throws Exception {
        var device = data.device(estate, location, asset, null);
        var lastSeen = OffsetDateTime.parse("2026-09-01T00:00:00Z");
        db.execute("update \"Device\" set \"lastSeenAt\"=?::timestamptz where id=?", lastSeen.toString(), device);
        var sensorId = UUID.randomUUID();
        db.execute(
                "insert into \"DeviceReading\" (id, \"estateId\", \"assetId\", \"deviceId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, 'TEMPERATURE', ?, ?::timestamptz, now())",
                sensorId,
                estate,
                asset,
                device,
                new BigDecimal("21"),
                TIME);
        mvc.perform(post(readings() + "/manual")
                        .with(jwt().jwt(j -> j.subject("import-owner")))
                        .contentType("application/json")
                        .content("""
                {"assetId":"%s","metric":"TEMPERATURE","value":"22","unit":"°C","measuredAt":"%s","submissionId":"%s"}
                """.formatted(asset, TIME, UUID.randomUUID())))
                .andExpect(status().isCreated());
        var assessments = db.fetch("select * from \"AssetAssessment\" where \"assetId\"=?", asset);
        var events = db.fetch("select * from \"AssetEvent\" where \"assetId\"=?", asset);
        var batch = importCsv(csv("23"));
        assertThat(list().path("totalItems").asInt()).isEqualTo(3);
        read(readings() + "?flag=DUPLICATE_TIMESTAMP", "import-owner")
                .andExpect(jsonPath("$.totalItems").value(3));
        assertThat(db.fetch("select * from \"AssetAssessment\" where \"assetId\"=?", asset))
                .isEqualTo(assessments);
        assertThat(db.fetch("select * from \"AssetEvent\" where \"assetId\"=?", asset))
                .isEqualTo(events);
        assertThat(db.fetchOne("select \"lastSeenAt\" from \"Device\" where id=?", device)
                        .get(0, OffsetDateTime.class))
                .isEqualTo(lastSeen);
        revert(batch, "manager", "Restore original history").andExpect(status().isOk());
        assertThat(list().path("totalItems").asInt()).isEqualTo(2);
        assertThat(db.fetch("select * from \"AssetAssessment\" where \"assetId\"=?", asset))
                .isEqualTo(assessments);
        assertThat(db.fetch("select * from \"AssetEvent\" where \"assetId\"=?", asset))
                .isEqualTo(events);
    }

    @Test
    void importedReadingsParticipateInFiltersPagingLegacyListsAndExactCsvExport() throws Exception {
        importCsv(HEADER + row("999999999999.123456", TIME) + row("22", "2026-10-02T00:00:00Z"));
        read(
                        readings() + "?assetId=" + asset
                                + "&metric=TEMPERATURE&from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&size=1",
                        "import-owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].valueText").value("999999999999.123456"));
        // Legacy asset history remains Owner-only; estate-wide readings allow Managers.
        read("/estates/" + estate + "/assets/" + asset + "/readings?size=1&page=1", "manager")
                .andExpect(status().isNotFound());
        read("/estates/" + estate + "/assets/" + asset + "/readings?size=1&page=1", "import-owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].source").value("IMPORT"));
        var csv = csvRecords(export());
        assertThat(csv.get(0)).hasSize(15);
        assertThat(csv).hasSize(3);
        assertThat(csv.get(2).get(6)).isEqualTo("999999999999.123456");
        assertThat(csv.get(2).get(8)).isEqualTo("IMPORT");
        assertThat(csv.get(2).subList(9, 13)).containsOnly("");
    }

    @Test
    void exportedImportedRowsRoundTripWithEscapedReferencesAndUnknownIdsCannotBeAssigned() throws Exception {
        db.execute("update \"Asset\" set reference=? where id=?", "=Pump, \"North\"\nLevel 1", asset);
        importCsv(csv("151"));
        var exported = export();
        var opts = options(UUID.randomUUID());
        opts.put("preset", "EXPORT");
        var batch = body(submit("import-owner", exported, opts).andExpect(status().isCreated()));
        counts(batch, 1, 0, 1, 0, 1);
        var records = csvRecords(exported);
        var knownId = records.get(1).get(0);
        var unknownId = UUID.randomUUID().toString();
        // A forged ID is merely provenance; changing the instant makes this a fresh measurement.
        var unknown = exported.replace(knownId, unknownId)
                .replace("2026-10-01T00:00:00.000000Z", "2026-10-02T00:00:00.000000Z");
        var created = body(submit("import-owner", unknown, optionsForExport()).andExpect(status().isCreated()));
        assertThat(created.path("importedRows").asInt()).isEqualTo(1);
        assertThat(list().path("items").get(0).path("id").asText()).isNotEqualTo(unknownId);
    }

    ObjectNode optionsForExport() {
        var opts = options(UUID.randomUUID());
        opts.put("preset", "EXPORT");
        return opts;
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void originalSensorAndManualExportsRoundTripWithoutCreatingImportedCopies(boolean uppercaseReadingIds)
            throws Exception {
        var device = data.device(estate, location, asset, null);
        db.execute(
                "insert into \"DeviceReading\" (id, \"estateId\", \"assetId\", \"deviceId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, 'TEMPERATURE', 21, ?::timestamptz, now())",
                UUID.randomUUID(),
                estate,
                asset,
                device,
                TIME);
        db.execute(
                "insert into \"ManualReading\" (id, \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"recordedAt\", \"recordedByUserId\", \"submissionId\") values (?, ?, ?, 'TEMPERATURE', 151, ?::timestamptz, now(), 'import-owner', ?)",
                UUID.randomUUID(),
                estate,
                asset,
                TIME,
                UUID.randomUUID());
        var csv = export();
        if (uppercaseReadingIds) {
            for (var record : csvRecords(csv).subList(1, 3)) {
                var readingId = record.getFirst();
                csv = csv.replace(readingId, readingId.toUpperCase(Locale.ROOT));
            }
        }
        var batch = body(submit("import-owner", csv, optionsForExport()).andExpect(status().isCreated()));
        counts(batch, 2, 0, 2, 0, 1);
        assertThat(list().path("totalItems").asInt()).isEqualTo(2);
        var tampered = csv.replace("\"151.000000\"", "\"152.000000\"");
        var conflict = body(submit("import-owner", tampered, optionsForExport()).andExpect(status().isCreated()));
        assertThat(conflict.path("invalidRows").asInt()).isEqualTo(1);
        assertThat(rows(conflict).toString()).contains("READING_CONFLICT");
        revert(batch, "manager", "Round trip only").andExpect(status().isOk());
        assertThat(list().path("totalItems").asInt()).isEqualTo(2);
    }
}
