package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;

/** Exercises the approved date-filter HTTP contract without requiring new production types. */
class AssetHistoryDateFilterIntegrationTests extends AssetHistoryTestSupport {
    @Test
    void filtersEverySourceByOccurrenceInsteadOfWhenItWasEntered() throws Exception {
        sources("2026-03-01");
        var inside = sources("2026-03-02");
        sources("2026-03-03");

        var result = range("member", "2026-03-02", "2026-03-02");
        assertEquals(
                new HashSet<>(inside.stream().map(UUID::toString).toList()),
                new HashSet<>(values(result.path("items"), "sourceId")));
        assertEquals(8, result.path("items").size());
        assertEquals(
                java.util.Set.of(
                        "MAINTENANCE",
                        "WORK_ORDER_COMPLETED",
                        "CONDITION",
                        "INSPECTION",
                        "LIFECYCLE",
                        "INVOICE",
                        "SERVICE_REPORT"),
                new HashSet<>(values(result.path("items"), "kind")));
        assertTrue(result.path("nextCursor").isNull());
    }

    @Test
    void includesBothSingaporeDaysAndExcludesTheFollowingMidnightAtMicrosecondPrecision() throws Exception {
        document("INVOICE", assetId, null, "2026-03-01T15:59:59.999999Z");
        UUID start = document("INVOICE", assetId, null, "2026-03-01T16:00:00Z");
        UUID end = document("SERVICE_REPORT", assetId, null, "2026-03-02T15:59:59.999999Z");
        document("SERVICE_REPORT", assetId, null, "2026-03-02T16:00:00Z");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-01");
        UUID day = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-03");

        var result = range("owner", "2026-03-02", "2026-03-02");
        assertEquals(
                List.of(end.toString(), day.toString(), start.toString()), values(result.path("items"), "sourceId"));
        assertEquals(
                "2026-03-02", result.path("items").get(1).path("occurredOn").asText());
    }

    @ParameterizedTest
    @CsvSource({
        "2026-03-02,,2026-03-03|2026-03-02",
        ",2026-03-02,2026-03-02|2026-03-01",
        ",,2026-03-03|2026-03-02|2026-03-01"
    })
    void omittedBoundsRemainUnbounded(String from, String to, String expected) throws Exception {
        for (int day = 1; day <= 3; day++) {
            maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-%02d".formatted(day));
        }
        assertEquals(
                List.of(expected.split("\\|")), values(range("owner", from, to).path("items"), "occurredOn"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2024-02-29", "2026-01-01", "2026-12-31"})
    void acceptsLeapDayAndRangesAcrossMonthAndYearBoundaries(String day) throws Exception {
        var target = LocalDate.parse(day);
        maintenance(
                UUID.randomUUID(), assetId, "PREVENTIVE", target.minusDays(1).toString());
        UUID included = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", day);
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", target.plusDays(1).toString());
        assertEquals(
                List.of(included.toString()), values(range("owner", day, day).path("items"), "sourceId"));
    }

    @ParameterizedTest
    @CsvSource({
        "from,''", "to,''",
        "from,2026-02-30", "to,2026-02-30",
        "from,2025-02-29", "to,2025-02-29",
        "from,2026-3-01", "to,2026-3-01",
        "from,2026-13-01", "to,2026-13-01",
        "from,2026-03-00", "to,2026-03-00",
        "from,tomorrow", "to,tomorrow",
        "from,2026-03-01T00:00:00Z", "to,2026-03-01T00:00:00Z"
    })
    void rejectsExplicitlyEmptyMalformedAndImpossibleDates(String field, String value) throws Exception {
        read("owner", get(history(assetId)).param(field, value))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.items").doesNotExist());
    }

    @Test
    void rejectsReversedBoundsWithAPrivateErrorEnvelope() throws Exception {
        read("member", get(history(assetId)).param("from", "2026-03-03").param("to", "2026-03-02"))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void filtersBeforePagingAndDeduplicatesBothDocumentPathsAcrossCompletePages() throws Exception {
        for (int day = 1; day <= 28; day++) {
            maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-04-%02d".formatted(day));
        }
        UUID older = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        UUID newer = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-03");
        UUID order = workOrder(estateId, assetId, locationId);
        UUID invoice = document("INVOICE", assetId, order, "2026-03-03T02:00:00Z");
        UUID report = document("SERVICE_REPORT", null, order, "2026-03-04T02:00:00Z");
        var deleted = document("INVOICE", assetId, null, "2026-03-04T03:00:00Z");
        db.execute("update \"Document\" set \"deletedAt\"=now(), \"deletedByUserId\"='owner' where id=?", deleted);
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-01");

        var firstRequest = get(history(assetId))
                .param("from", "2026-03-02")
                .param("to", "2026-03-04")
                .param("limit", "2");
        var first = body(read("member", firstRequest).andExpect(status().isOk()));
        assertEquals(List.of(report.toString(), invoice.toString()), values(first.path("items"), "sourceId"));
        assertFalse(first.path("nextCursor").isNull());
        var nextRequest = get(history(assetId))
                .param("from", "2026-03-02")
                .param("to", "2026-03-04")
                .param("limit", "2")
                .param("cursor", first.path("nextCursor").asText());
        var last = body(read("member", nextRequest).andExpect(status().isOk()));
        assertEquals(List.of(newer.toString(), older.toString()), values(last.path("items"), "sourceId"));
        assertTrue(last.path("nextCursor").isNull());
        var replay = body(read("member", nextRequest).andExpect(status().isOk()));
        assertEquals(last, replay);
    }

    @Test
    void preservesKindAndUuidTieBreakersWhenPagingOneSingaporeDay() throws Exception {
        UUID low = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID high = UUID.fromString("f0000000-0000-0000-0000-000000000002");
        maintenance(low, assetId, "BREAKDOWN_REPAIR", "2026-03-02");
        maintenance(high, assetId, "PREVENTIVE", "2026-03-02");
        UUID condition = assessment("HUMAN", "2026-03-02");
        UUID inspection = inspection("2026-03-02");
        UUID invoice = document("INVOICE", assetId, null, "2026-03-01T16:00:00Z");
        document("INVOICE", assetId, null, "2026-03-02T16:00:00Z");
        var found = new ArrayList<String>();
        var cursors = new HashSet<String>();
        String cursor = null;
        do {
            var request = get(history(assetId))
                    .param("from", "2026-03-02")
                    .param("to", "2026-03-02")
                    .param("limit", "2");
            if (cursor != null) request.param("cursor", cursor);
            var result = body(read("owner", request).andExpect(status().isOk()));
            found.addAll(values(result.path("items"), "sourceId"));
            cursor = result.path("nextCursor").isNull()
                    ? null
                    : result.path("nextCursor").asText();
            if (cursor != null) assertTrue(cursors.add(cursor), "Filtered pagination must advance");
        } while (cursor != null);
        assertEquals(
                List.of(high, low, invoice, inspection, condition).stream()
                        .map(UUID::toString)
                        .toList(),
                found);
    }

    @ParameterizedTest
    @CsvSource({"2026-03-02,2026-03-03", "2026-03-01,2026-03-04", ",2026-03-03", "2026-03-01,", ","})
    void rejectsCursorReuseAfterChangingOrClearingEitherBound(String from, String to) throws Exception {
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-03");
        var first = body(read(
                        "owner",
                        get(history(assetId))
                                .param("from", "2026-03-01")
                                .param("to", "2026-03-03")
                                .param("limit", "1"))
                .andExpect(status().isOk()));
        assertFalse(first.path("nextCursor").isNull());
        var request =
                get(history(assetId)).param("cursor", first.path("nextCursor").asText());
        if (from != null) request.param("from", from);
        if (to != null) request.param("to", to);
        read("owner", request)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void rejectsAnUnfilteredCursorWhenDatesAreAdded() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-03");
        var first =
                body(read("owner", get(history(assetId)).param("limit", "1")).andExpect(status().isOk()));
        read(
                        "owner",
                        get(history(assetId))
                                .param("from", "2026-03-01")
                                .param("to", "2026-03-03")
                                .param("cursor", first.path("nextCursor").asText()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void rejectsLegacyTimelineCursorsWithTheExistingBadRequestEnvelope() throws Exception {
        var cursor = String.join(
                ".",
                List.of(
                                "history-v1",
                                estateId.toString(),
                                assetId.toString(),
                                "2026-03-03T00:00:00+08:00",
                                "MAINTENANCE",
                                UUID.randomUUID().toString())
                        .stream()
                        .map(part -> Base64.getUrlEncoder()
                                .withoutPadding()
                                .encodeToString(part.getBytes(StandardCharsets.UTF_8)))
                        .toList());
        read("owner", get(history(assetId)).param("cursor", cursor))
                .andExpect(status().isBadRequest())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void emptyDateRangeKeepsTheAssetSummaryAndDocumentVisibility() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-01");
        var result = range("member", "2030-01-01", "2030-01-31");
        assertEquals(assetId.toString(), result.path("asset").path("id").asText());
        assertEquals("Water pump", result.path("asset").path("name").asText());
        assertTrue(result.path("documentsVisible").asBoolean());
        assertTrue(result.path("items").isEmpty());
        assertTrue(result.path("nextCursor").isNull());
    }

    @Test
    void correctionsAndNewLinksKeepTheirOriginalEventDates() throws Exception {
        UUID order = workOrder(estateId, assetId, locationId);
        UUID completed = completion(order, "2026-03-02T02:00:00Z");
        db.execute(
                "update \"WorkOrderCompletion\" set \"editedAt\"='2026-04-02T02:00:00Z', \"editedByUserId\"='owner', findings='Corrected' where id=?",
                completed);
        var invoice = document("INVOICE", null, null, "2026-02-28T02:00:00Z");
        db.execute("update \"Document\" set \"assetId\"=?, \"workOrderId\"=? where id=?", assetId, order, invoice);

        var march = range("owner", "2026-03-02", "2026-03-02");
        assertEquals(List.of(completed.toString()), values(march.path("items"), "sourceId"));
        assertEquals(
                "Corrected",
                march.path("items").get(0).path("details").path("findings").asText());
        assertEquals(
                List.of(invoice.toString()),
                values(range("owner", "2026-02-28", "2026-02-28").path("items"), "sourceId"));
        assertTrue(range("owner", "2026-04-02", "2026-04-02").path("items").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "member"})
    void rangesRemainReadableForRetiredAssetsAndInactiveEstates(String user) throws Exception {
        UUID included = maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-04-02");
        db.execute("update \"Asset\" set \"deactivatedAt\"=now(), \"retiredOn\"='2026-09-01' where id=?", assetId);
        inactive();
        var result = range(user, "2026-03-01", "2026-03-31");
        assertEquals("RETIRED", result.path("asset").path("status").asText());
        assertEquals(List.of(included.toString()), values(result.path("items"), "sourceId"));
    }

    @Test
    void everyFilteredPageStillRechecksMembershipAndEstateScope() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-02");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-03-03");
        var first = body(
                read("member", get(history(assetId)).param("from", "2026-03-01").param("limit", "1"))
                        .andExpect(status().isOk()));
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='member'", estateId);
        read(
                        "member",
                        get(history(assetId))
                                .param("from", "2026-03-01")
                                .param("cursor", first.path("nextCursor").asText()))
                .andExpect(status().isNotFound());
        read("resident", get(history(assetId)).param("from", "2026-03-01")).andExpect(status().isForbidden());
        read("outsider", get(history(assetId)).param("from", "2026-03-01")).andExpect(status().isNotFound());
        var foreign = estate("other");
        var foreignLocation = location(foreign, "BLOCK", null, "Other block", null);
        var foreignAsset = asset(foreign, foreignLocation, "OTHER-A0001", "Foreign pump");
        read("owner", get(history(foreignAsset)).param("from", "2026-03-01")).andExpect(status().isNotFound());
    }

    private List<UUID> sources(String day) {
        var order = workOrder(estateId, assetId, locationId);
        return List.of(
                maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", day),
                maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", day),
                assessment("ANOMALY_MODEL", day),
                inspection(day),
                completion(order, day + "T02:00:00Z"),
                lifecycle("RETIRED", LocalDate.parse(day).getDayOfMonth(), day + "T02:00:00Z"),
                document("INVOICE", assetId, null, day + "T02:00:00Z"),
                document("SERVICE_REPORT", null, order, day + "T02:00:00Z"));
    }

    private JsonNode range(String user, String from, String to) throws Exception {
        var request = get(history(assetId));
        if (from != null) request.param("from", from);
        if (to != null) request.param("to", to);
        return body(read(user, request)
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store")));
    }
}
