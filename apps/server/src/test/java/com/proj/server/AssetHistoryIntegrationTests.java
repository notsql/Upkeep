package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AssetHistoryIntegrationTests extends AssetHistoryTestSupport {
    @Test
    void combinesEveryEligibleSourceByOccurrenceRatherThanEntryTime() throws Exception {
        UUID repair = maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-01-01");
        UUID preventive = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-02-01");
        UUID condition = assessment("HUMAN", "2026-03-01");
        UUID inspection = inspection("2026-04-01");
        UUID order = workOrder(estateId, assetId, locationId);
        UUID completion = completion(order, "2026-05-01T02:00:00Z");
        UUID retired = lifecycle("RETIRED", 1, "2026-06-01T02:00:00Z");
        UUID invoice = document("INVOICE", assetId, null, "2026-07-01T02:00:00Z");
        UUID report = document("SERVICE_REPORT", null, order, "2026-08-01T02:00:00Z");
        UUID other = asset(estateId, locationId, "E-A0002", "Other pump");
        maintenance(UUID.randomUUID(), other, "PREVENTIVE", "2026-09-01");
        workOrder(estateId, assetId, locationId); // An open job is not a completion.

        var page = page("owner", history(assetId));
        var items = page.path("items");
        assertEquals(
                List.of(report, invoice, retired, completion, inspection, condition, preventive, repair).stream()
                        .map(UUID::toString)
                        .toList(),
                values(items, "sourceId"));
        assertEquals(
                List.of(
                        "SERVICE_REPORT",
                        "INVOICE",
                        "LIFECYCLE",
                        "WORK_ORDER_COMPLETED",
                        "INSPECTION",
                        "CONDITION",
                        "MAINTENANCE",
                        "MAINTENANCE"),
                values(items, "kind"));
        assertTrue(page.path("nextCursor").isNull());
        assertTrue(page.path("documentsVisible").asBoolean());
        for (var item : items) {
            assertEquals(
                    item.path("kind").asText() + ":" + item.path("sourceId").asText(),
                    item.path("id").asText());
            assertFalse(item.path("title").asText().isBlank());
            assertFalse(item.path("recordedAt").asText().isBlank());
            assertTrue(item.path("details").isObject());
            assertNotEquals(
                    item.path("occurredOn").isNull(), item.path("occurredAt").isNull());
        }
        assertEquals("Service report uploaded", items.get(0).path("title").asText());
        assertEquals("Invoice uploaded", items.get(1).path("title").asText());
        assertEquals("2026-01-01", items.get(7).path("occurredOn").asText());
        assertEquals(
                Instant.parse(RECORDED_AT),
                timestamp(items.get(7).path("recordedAt")).toInstant());
        assertEquals(
                Instant.parse("2026-08-01T02:00:00Z"),
                timestamp(items.get(0).path("occurredAt")).toInstant());
        assertEquals(
                "2026-03-01", items.get(5).path("details").path("assessedOn").asText());
        assertEquals(
                "Vibration increased",
                items.get(5).path("details").path("notes").asText());
        assertEquals("FAIL", items.get(4).path("details").path("outcome").asText());
        assertEquals("Seal leaking", items.get(4).path("details").path("notes").asText());
    }

    @Test
    void pagesTheCombinedOrderingWithSingaporeMidnightAndDescendingKindAndUuidTies() throws Exception {
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("f0000000-0000-0000-0000-000000000002");
        maintenance(low, assetId, "BREAKDOWN_REPAIR", "2026-03-02");
        maintenance(high, assetId, "PREVENTIVE", "2026-03-02");
        UUID condition = assessment("HUMAN", "2026-03-02");
        UUID inspection = inspection("2026-03-02");
        UUID atMidnight = document("INVOICE", assetId, null, "2026-03-01T16:00:00Z");
        UUID beforeMidnight = document("SERVICE_REPORT", assetId, null, "2026-03-01T15:59:59.999999Z");
        UUID afterMidnight = document("INVOICE", assetId, null, "2026-03-01T16:00:00.000001Z");
        var expected = List.of(afterMidnight, high, low, atMidnight, inspection, condition, beforeMidnight).stream()
                .map(UUID::toString)
                .toList();
        var found = new ArrayList<String>();
        var cursors = new HashSet<String>();
        String cursor = null;
        do {
            var request = get(history(assetId)).param("limit", "2");
            if (cursor != null) request.param("cursor", cursor);
            var page = body(read("owner", request).andExpect(status().isOk()));
            assertEquals(
                    Math.min(2, expected.size() - found.size()),
                    page.path("items").size());
            found.addAll(values(page.path("items"), "sourceId"));
            cursor = page.path("nextCursor").isNull()
                    ? null
                    : page.path("nextCursor").asText();
            if (cursor != null) assertTrue(cursors.add(cursor), "Pagination must advance");
        } while (cursor != null);
        assertEquals(expected, found);
        assertEquals(found.size(), new HashSet<>(found).size());
    }

    @Test
    void replayingACursorReturnsTheSamePageAndFreshReadIncludesBackdatedWrites() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-06-01");
        UUID older = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-01-01");
        var first =
                body(read("owner", get(history(assetId)).param("limit", "1")).andExpect(status().isOk()));
        String cursor = first.path("nextCursor").asText();
        var second =
                body(read("owner", get(history(assetId)).param("limit", "1").param("cursor", cursor))
                        .andExpect(status().isOk()));
        assertEquals(List.of(older.toString()), values(second.path("items"), "sourceId"));
        var replay =
                body(read("owner", get(history(assetId)).param("limit", "1").param("cursor", cursor))
                        .andExpect(status().isOk()));
        assertEquals(second, replay);
        UUID backdated = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-01");
        var refreshed = page("owner", history(assetId));
        assertEquals(
                backdated.toString(),
                refreshed.path("items").get(1).path("sourceId").asText());
    }

    @Test
    void returnsOnlyRecordedHistoryAndAnIdentitySummaryEvenWithoutInstallationOrEvents() throws Exception {
        read("member", get(history(assetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.asset.id").value(assetId.toString()))
                .andExpect(jsonPath("$.asset.reference").value("E-A0001"))
                .andExpect(jsonPath("$.asset.name").value("Water pump"))
                .andExpect(jsonPath("$.asset.category").value("PUMP"))
                .andExpect(jsonPath("$.asset.locationPath").value("Block A"))
                .andExpect(jsonPath("$.asset.status").value("ACTIVE"))
                .andExpect(jsonPath("$.asset.installedOn").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.asset.retiredOn").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()));
        db.execute("update \"Asset\" set \"installedOn\"='2020-01-01' where id=?", assetId);
        read("member", get(history(assetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.asset.installedOn").value("2020-01-01"))
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"HUMAN", "ANOMALY_MODEL"})
    void conditionHistoryPreservesStoredProvenanceWithoutCreatingMoreAssessments(String origin) throws Exception {
        UUID assessment = assessment(origin, "2026-03-01");
        var before = db.fetch("select * from \"AssetAssessment\" where \"assetId\"=?", assetId)
                .intoMaps();
        read("member", get(history(assetId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].sourceId").value(assessment.toString()))
                .andExpect(jsonPath("$.items[0].details.origin").value(origin))
                .andExpect(jsonPath("$.items[0].details.condition").value("NEEDS_ATTENTION"))
                .andExpect(jsonPath("$.items[0].details.notes").value("Vibration increased"))
                .andExpect(jsonPath("$.items[0].details.recordedByUserId").doesNotExist());
        assertEquals(
                before,
                db.fetch("select * from \"AssetAssessment\" where \"assetId\"=?", assetId)
                        .intoMaps());
    }

    @Test
    void completionCorrectionsKeepCanonicalIdentityAndOriginalTimeAndManualRepairsStaySeparate() throws Exception {
        UUID order = workOrder(estateId, assetId, locationId);
        UUID completion = completion(order, "2026-03-01T02:00:00Z");
        UUID manual = maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-03-01");
        var before = page("owner", history(assetId)).path("items");
        db.execute("""
                update "WorkOrderCompletion" set findings='Corrected findings', "workPerformed"='Corrected work',
                "editedAt"='2026-04-01T02:00:00Z', "editedByUserId"='owner' where id=?
                """, completion);
        db.execute("""
                insert into "WorkOrderCompletionRevision"
                (id, "estateId", "workOrderId", "fromVersion", version, "correctionReason", "changedByUserId", "beforeOutcome", "afterOutcome")
                values (?, ?, ?, 1, 2, 'Corrected transcription', 'owner', '{}'::jsonb, '{}'::jsonb)
                """, UUID.randomUUID(), estateId, order);
        var after = page("owner", history(assetId)).path("items");
        assertEquals(List.of(completion.toString(), manual.toString()), values(after, "sourceId"));
        assertEquals(values(before, "id"), values(after, "id"));
        assertEquals(before.get(0).path("occurredAt"), after.get(0).path("occurredAt"));
        assertEquals(
                "Corrected findings",
                after.get(0).path("details").path("findings").asText());
        assertEquals(
                "Corrected work",
                after.get(0).path("details").path("workPerformed").asText());
        assertEquals(
                Instant.parse("2026-04-01T02:00:00Z"),
                timestamp(after.get(0).path("details").path("editedAt")).toInstant());
    }

    @Test
    void maintenanceKeepsUnknownCostsAndDowntimeDistinctFromZero() throws Exception {
        UUID unknown = maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-03-02");
        UUID zero = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-01");
        db.execute(
                "update \"AssetEvent\" set \"labourCost\"=0, \"partsCost\"=0, \"otherCost\"=0, \"downtimeMinutes\"=0 where id=?",
                zero);
        var items = page("member", history(assetId)).path("items");
        assertEquals(List.of(unknown.toString(), zero.toString()), values(items, "sourceId"));
        for (String field :
                List.of("labourCost", "partsCost", "otherCost", "totalCost", "downtimeMinutes", "serviceProvider"))
            assertTrue(items.get(0).path("details").path(field).isNull(), field + " must remain unknown");
        assertEquals("0.00", items.get(1).path("details").path("totalCost").asText());
        assertEquals(0, items.get(1).path("details").path("downtimeMinutes").asInt(-1));
    }

    @Test
    void lifecycleAuditAndHistorySurviveRetirementRestorationAndRelocation() throws Exception {
        UUID retired = lifecycle("RETIRED", 1, "2026-06-01T02:00:00Z");
        UUID corrected = lifecycle("CORRECTED", 2, "2026-07-01T02:00:00Z");
        UUID restored = lifecycle("RESTORED", 3, "2026-08-01T02:00:00Z");
        UUID movedTo = location(estateId, "BLOCK", null, "Block B", null);
        db.execute("update \"Asset\" set \"locationId\"=? where id=?", movedTo, assetId);
        var page = page("member", history(assetId));
        assertEquals("Block B", page.path("asset").path("locationPath").asText());
        assertEquals(
                List.of(restored, corrected, retired).stream()
                        .map(UUID::toString)
                        .toList(),
                values(page.path("items"), "sourceId"));
        assertEquals(List.of("LIFECYCLE", "LIFECYCLE", "LIFECYCLE"), values(page.path("items"), "kind"));
    }

    @Test
    void defaultPageIsBoundedAndFollowsThroughAllSourcesBeyondTwentyFiveRecords() throws Exception {
        for (int day = 1; day <= 28; day++) {
            maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-02-%02d".formatted(day));
            document("INVOICE", assetId, null, "2026-02-%02dT02:00:00Z".formatted(day));
        }
        var all = new HashSet<String>();
        var first = page("owner", history(assetId));
        assertEquals(25, first.path("items").size());
        all.addAll(values(first.path("items"), "id"));
        String cursor = first.path("nextCursor").asText();
        var second = body(
                read("owner", get(history(assetId)).param("cursor", cursor)).andExpect(status().isOk()));
        assertEquals(25, second.path("items").size());
        all.addAll(values(second.path("items"), "id"));
        var last = body(read(
                        "owner",
                        get(history(assetId))
                                .param("cursor", second.path("nextCursor").asText()))
                .andExpect(status().isOk()));
        assertEquals(6, last.path("items").size());
        all.addAll(values(last.path("items"), "id"));
        assertEquals(56, all.size());
        assertTrue(last.path("nextCursor").isNull());
    }
}
