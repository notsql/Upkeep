package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

class ReadingImportValidationIntegrationTests extends ReadingImportTestSupport {
    @ParameterizedTest
    @EnumSource(com.proj.server.device.DeviceMetric.class)
    void derivesTheFixedUnitForEveryCatalogueMetricWithoutDeviceRegistration(com.proj.server.device.DeviceMetric metric)
            throws Exception {
        var batch = importCsv(HEADER + asset + "," + metric.name() + "," + TIME + ",1\n");
        counts(batch, 1, 1, 0, 0, 0);
        assertThat(list().path("items").get(0).path("unit").asText()).isEqualTo(metric.unit());
    }

    @Test
    void importsHistoricalMeasurementsWithoutADeviceAndKeepsExactDecimalText() throws Exception {
        var batch = importCsv(csv("999999999999.123456"));
        counts(batch, 1, 1, 0, 0, 1);
        var reading = list().path("items").get(0);
        assertThat(reading.path("source").asText()).isEqualTo("IMPORT");
        assertThat(reading.path("valueText").asText()).isEqualTo("999999999999.123456");
        assertThat(reading.path("importBatchId").asText())
                .isEqualTo(batch.path("id").asText());
        assertThat(reading.path("sourceLabel").asText()).isEqualTo(SOURCE);
        assertThat(reading.path("deviceId").isNull()).isTrue();
        assertThat(reading.path("recordedByUserId").isNull()).isTrue();
        assertThat(db.fetchOne("select count(*) from \"Device\" where \"estateId\"=?", estate)
                        .get(0, Integer.class))
                .isZero();
    }

    @Test
    void importsGoodRowsAndReportsEveryRejectedOrDuplicateRecord() throws Exception {
        var csv = HEADER + row("21", TIME)
                + UUID.randomUUID() + ",TEMPERATURE," + TIME + ",22\n"
                + row("23", "not-a-date") + row("21.000000", TIME);
        var batch = importCsv(csv);
        counts(batch, 4, 1, 1, 2, 0);
        var report = rows(batch).path("items");
        assertThat(report.get(0).path("outcome").asText()).isEqualTo("IMPORTED");
        assertThat(report.get(1).path("issues").toString()).contains("ASSET_NOT_FOUND");
        assertThat(report.get(2).path("issues").toString()).contains("INVALID_TIMESTAMP");
        assertThat(report.get(3).path("outcome").asText()).isEqualTo("DUPLICATE");
        assertThat(report.get(0).path("recordNumber").asInt()).isEqualTo(2);
        assertThat(list().path("totalItems").asInt()).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "not-a-number",
                "NaN",
                "Infinity",
                "-Infinity",
                "1000000000000",
                "-1000000000000",
                "0.0000001",
                "21.1234567",
                "1e999999999",
                "1e-999999999"
            })
    void rejectsInvalidDecimalsWithoutRejectingTheOtherRows(String value) throws Exception {
        var batch = importCsv(HEADER + row(value, TIME) + row("22", "2026-10-02T00:00:00Z"));
        counts(batch, 2, 1, 0, 1, 0);
        assertThat(rows(batch).path("items").get(0).path("issues").toString()).contains("value");
        assertThat(list().path("items").get(0).path("valueText").asText()).isEqualTo("22");
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.000001", "21.123456000", "999999999999.999999", "-999999999999.999999"})
    void acceptsRepresentableDecimalsIncludingEquivalentTrailingZeroes(String value) throws Exception {
        var batch = importCsv(csv(value));
        assertThat(batch.path("importedRows").asInt()).isEqualTo(1);
        assertThat(batch.path("invalidRows").asInt()).isZero();
        assertThat(new java.math.BigDecimal(
                        list().path("items").get(0).path("valueText").asText()))
                .isEqualByComparingTo(value);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {"2026-10-01T00:00:00", "01/10/2026 08:00", "2026-02-30T00:00:00Z", "2026-10-01T25:00:00Z", ""})
    void rejectsAmbiguousOrImpossibleTimestamps(String time) throws Exception {
        var batch = importCsv(HEADER + row("21", time));
        counts(batch, 1, 0, 0, 1, 0);
        assertThat(rows(batch).path("items").get(0).path("issues").toString()).contains("INVALID_TIMESTAMP");
    }

    @Test
    void rejectsReadingsWellBeyondTheFiveMinuteFutureAllowance() throws Exception {
        var batch = importCsv(HEADER
                + row(
                        "21",
                        java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC)
                                .plusMinutes(10)
                                .toString()));
        counts(batch, 1, 0, 0, 1, 0);
    }

    @Test
    void acceptsOldOutOfOrderObservationsAndNormalizesOffsetAndMicroseconds() throws Exception {
        var batch = importCsv(
                HEADER + row("21", "2020-01-01T08:00:00.123456789+08:00") + row("22", "2019-01-01T00:00:00Z"));
        counts(batch, 2, 2, 0, 0, 0);
        assertThat(list().path("items").get(0).path("measuredAt").asText()).isEqualTo("2020-01-01T00:00:00.123456Z");
    }

    @ParameterizedTest
    @CsvSource({"-40,0", "150,0", "-40.000001,1", "150.000001,1"})
    void rangeBoundariesAreInclusiveAndOutliersImportWithWarnings(String value, int warnings) throws Exception {
        var batch = importCsv(csv(value));
        counts(batch, 1, 1, 0, 0, warnings);
        read(readings() + "?flag=OUT_OF_RANGE", "import-owner")
                .andExpect(jsonPath("$.totalItems").value(warnings));
    }

    @Test
    void rejectsWrongUnitsAndUnknownMetricsWithoutInventingDependentRangeErrors() throws Exception {
        var opts = options(UUID.randomUUID());
        opts.withObject("/mapping").put("unit", "unit");
        var batch = body(submit(
                        "import-owner",
                        HEADER.stripTrailing() + ",unit\n"
                                + row("21", TIME).stripTrailing() + ",bar\n"
                                + asset + ",temperature," + TIME + ",999,°C\n",
                        opts)
                .andExpect(status().isCreated()));
        counts(batch, 2, 0, 0, 2, 0);
        var report = rows(batch).path("items");
        assertThat(report.get(0).path("issues").toString()).contains("unit");
        assertThat(report.get(1).path("issues").toString()).contains("metric").doesNotContain("OUT_OF_RANGE");
    }

    @Test
    void collectsIndependentErrorsOnTheSameRow() throws Exception {
        var batch = importCsv(HEADER + UUID.randomUUID() + ",UNKNOWN,not-a-date,NaN\n");
        var issues = rows(batch).path("items").get(0).path("issues");
        assertThat(issues.toString()).contains("ASSET_NOT_FOUND", "metric", "INVALID_TIMESTAMP", "value");
        assertThat(issues.size()).isGreaterThanOrEqualTo(4);
    }

    @Test
    void hidesForeignAssetDetailsAndRejectsRetiredAssetsWhileImportingActiveRows() throws Exception {
        var foreign = fixture("other-owner");
        var retired = data.asset(estate, location);
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", retired);
        var batch = importCsv(HEADER + row("21", TIME) + foreign[2] + ",TEMPERATURE," + TIME + ",22\n" + retired
                + ",TEMPERATURE,2020-01-01T00:00:00Z,23\n");
        counts(batch, 3, 1, 0, 2, 0);
        var report = rows(batch).path("items");
        assertThat(report.get(1).path("issues").toString())
                .contains("ASSET_NOT_FOUND")
                .doesNotContain("Water Pump");
        assertThat(report.get(2).path("issues").toString()).contains("ASSET_RETIRED");
    }

    @Test
    void mapsVendorHeadersAndPreservesQuotedCommasQuotesNewlinesAndReferenceApostrophes() throws Exception {
        var reference = "'Pump, \"North\"\nLevel 1";
        db.execute("update \"Asset\" set reference=? where id=?", reference, asset);
        var opts = options(UUID.randomUUID());
        opts.put("assetLookupMode", "asset_reference");
        var mapping = opts.putObject("mapping");
        mapping.put("asset_reference", "Equipment");
        mapping.put("metric", "Signal");
        mapping.put("measured_at", "Observed");
        mapping.put("value", "Measurement");
        var csv = "\uFEFFEquipment,Signal,Observed,Measurement\r\n\"'Pump, \"\"North\"\"\nLevel 1\",TEMPERATURE," + TIME
                + ",21\r\n";
        var batch = body(submit("import-owner", csv, opts).andExpect(status().isCreated()));
        counts(batch, 1, 1, 0, 0, 0);
        assertThat(list().path("items").get(0).path("assetReference").asText()).isEqualTo(reference);
        assertThat(rows(batch).path("items").get(0).path("startingLineNumber").asInt())
                .isEqualTo(2);
    }

    @Test
    void blankRecordsDoNotAffectTotalsOrRecordNumbersButPhysicalLinesRemainAccurate() throws Exception {
        var batch = importCsv(HEADER + "\n" + row("21", TIME) + "\n" + row("NaN", "2026-10-02T00:00:00Z"));
        counts(batch, 2, 1, 0, 1, 0);
        var report = rows(batch).path("items");
        assertThat(report.get(0).path("recordNumber").asInt()).isEqualTo(2);
        assertThat(report.get(0).path("startingLineNumber").asInt()).isEqualTo(3);
        assertThat(report.get(1).path("recordNumber").asInt()).isEqualTo(3);
        assertThat(report.get(1).path("startingLineNumber").asInt()).isEqualTo(5);
    }

    @Test
    void multilineRecordsHaveOneRecordNumberAndTheNextRowRetainsItsPhysicalLine() throws Exception {
        var batch = importCsv(
                HEADER.stripTrailing() + ",note\n" + row("21", TIME).stripTrailing() + ",\"Vendor note\nsecond line\"\n"
                        + row("NaN", "2026-10-02T00:00:00Z").stripTrailing() + ",plain\n");
        counts(batch, 2, 1, 0, 1, 0);
        var report = rows(batch).path("items");
        assertThat(report.get(0).path("recordNumber").asInt()).isEqualTo(2);
        assertThat(report.get(0).path("startingLineNumber").asInt()).isEqualTo(2);
        assertThat(report.get(1).path("recordNumber").asInt()).isEqualTo(3);
        assertThat(report.get(1).path("startingLineNumber").asInt()).isEqualTo(4);
    }

    @Test
    void partiallyEmptyRecordsAreInvalidRatherThanSilentlyIgnored() throws Exception {
        var batch = importCsv(HEADER + ",TEMPERATURE,,\n");
        counts(batch, 1, 0, 0, 1, 0);
        assertThat(rows(batch).path("items").get(0).path("issues").toString())
                .contains("asset", "measured_at", "value");
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "asset_id,metric,measured_at,value\n",
                "asset_id,metric,metric,value\n1,2,3,4\n",
                "asset_id,,measured_at,value\n1,2,3,4\n"
            })
    void rejectsEmptyFilesAndMissingOrDuplicateHeaders(String csv) throws Exception {
        submit("import-owner", csv, options(UUID.randomUUID()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(list().path("totalItems").asInt()).isZero();
    }

    @Test
    void malformedQuotingAfterAValidRowRejectsTheEntireFile() throws Exception {
        submit("import-owner", csv("21") + "\"unterminated\n", options(UUID.randomUUID()))
                .andExpect(status().isBadRequest());
        assertThat(list().path("totalItems").asInt()).isZero();
        read(imports(), "import-owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void rejectsInvalidUtf8WithoutImportingItsValidPrefix() throws Exception {
        var prefix = csv("21").getBytes(StandardCharsets.UTF_8);
        var bytes = java.util.Arrays.copyOf(prefix, prefix.length + 2);
        bytes[prefix.length] = (byte) 0xC3;
        bytes[prefix.length + 1] = (byte) 0x28;
        mvc.perform(upload(bytes, options(UUID.randomUUID())).with(jwt().jwt(j -> j.subject("import-owner"))))
                .andExpect(status().isUnsupportedMediaType());
        assertThat(list().path("totalItems").asInt()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"missing", "reused", "both-assets", "absent-column"})
    void rejectsIncompleteOrAmbiguousMappingBeforeAnyInsert(String defect) throws Exception {
        var opts = options(UUID.randomUUID());
        var mapping = opts.withObject("/mapping");
        switch (defect) {
            case "missing" -> mapping.remove("value");
            case "reused" -> mapping.put("value", "metric");
            case "both-assets" -> mapping.put("asset_reference", "asset_id");
            case "absent-column" -> mapping.put("value", "missing-header");
            default -> throw new IllegalArgumentException(defect);
        }
        submit("import-owner", csv("21"), opts).andExpect(status().isBadRequest());
        assertThat(list().path("totalItems").asInt()).isZero();
    }

    @Test
    void requiresAFileSourceLabelAndValidSubmissionUuid() throws Exception {
        var opts = options(UUID.randomUUID());
        opts.put("sourceLabel", " ");
        submit("import-owner", csv("21"), opts).andExpect(status().isBadRequest());
        opts.put("sourceLabel", SOURCE).put("submissionId", "not-a-uuid");
        submit("import-owner", csv("21"), opts).andExpect(status().isBadRequest());
        mvc.perform(multipart(imports())
                        .file(new MockMultipartFile(
                                "options", "", "application/json", JSON.writeValueAsBytes(options(UUID.randomUUID()))))
                        .with(jwt().jwt(j -> j.subject("import-owner"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void recordLimitFailureDoesNotLeaveTheValidPrefixImported() throws Exception {
        var csv = HEADER + row("21", TIME).repeat(100_001);
        submit("import-owner", csv, options(UUID.randomUUID())).andExpect(status().isPayloadTooLarge());
        assertThat(list().path("totalItems").asInt()).isZero();
    }
}
