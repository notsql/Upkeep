package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class AssetHistoryAssetListIntegrationTests extends AssetHistoryTestSupport {
    @Test
    void councilBrowsesActiveAndRetiredAssetsWithoutAnExistingProfileLink() throws Exception {
        UUID retired = asset(estateId, locationId, "E-A0002", "Water pump");
        db.execute("update \"Asset\" set \"deactivatedAt\"=now(), \"retiredOn\"='2026-09-01' where id=?", retired);
        var all = page("member", historyAssets());
        assertEquals(List.of(assetId.toString(), retired.toString()), values(all.path("items"), "id"));
        assertEquals(List.of("ACTIVE", "RETIRED"), values(all.path("items"), "status"));
        read("member", get(historyAssets()).param("status", "ACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(assetId.toString()));
        read("member", get(historyAssets()).param("status", "INACTIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(retired.toString()));
        read("member", get(historyAssets()).param("status", "ALL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));
        for (var summary : all.path("items")) {
            var profile =
                    page("member", history(UUID.fromString(summary.path("id").asText())));
            assertEquals(summary, profile.path("asset"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"e-a0001", "  E-a0001  ", "WATER", "  pUmP  "})
    void searchMatchesLiteralCaseInsensitiveReferenceOrNameSubstrings(String query) throws Exception {
        asset(estateId, locationId, "E-A0002", "Lift motor");
        read("member", get(historyAssets()).param("q", query))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(assetId.toString()));
    }

    @ParameterizedTest
    @CsvSource({"%, Percentage % pump", "_, Under_score pump", "\\, Back\\slash pump"})
    void searchTreatsSqlWildcardsAndEscapeCharactersLiterally(String query, String name) throws Exception {
        UUID match = asset(estateId, locationId, "E-A0002", name);
        asset(estateId, locationId, "E-A0003", "Unrelated pump");
        read("member", get(historyAssets()).param("q", query))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(match.toString()));
    }

    @Test
    void filtersBeforePaginationAndKeepsDuplicateNamesDistinctInReferenceOrder() throws Exception {
        for (int i = 2; i <= 28; i++) asset(estateId, locationId, "E-A%04d".formatted(i), "Unrelated motor");
        UUID first = asset(estateId, locationId, "E-A0100", "Searchable pump");
        UUID second = asset(estateId, locationId, "E-A0200", "Searchable pump");
        UUID retired = asset(estateId, locationId, "E-A0300", "Searchable pump");
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", retired);
        var page = body(
                read("member", get(historyAssets()).param("q", "searchable").param("limit", "1"))
                        .andExpect(status().isOk()));
        assertEquals(List.of(first.toString()), values(page.path("items"), "id"));
        var secondPage = body(read(
                        "member",
                        get(historyAssets())
                                .param("q", "searchable")
                                .param("limit", "1")
                                .param("cursor", page.path("nextCursor").asText()))
                .andExpect(status().isOk()));
        assertEquals(List.of(second.toString()), values(secondPage.path("items"), "id"));
        var last = body(read(
                        "member",
                        get(historyAssets())
                                .param("q", "searchable")
                                .param("limit", "1")
                                .param("cursor", secondPage.path("nextCursor").asText()))
                .andExpect(status().isOk()));
        assertEquals(List.of(retired.toString()), values(last.path("items"), "id"));
        assertTrue(last.path("nextCursor").isNull());
        read(
                        "member",
                        get(historyAssets())
                                .param("q", "searchable")
                                .param("status", "INACTIVE")
                                .param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(retired.toString()))
                .andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void blankSearchListsEverythingAndNoMatchesRemainDistinctFromAnEmptyEstate() throws Exception {
        for (String query : List.of("", "   ")) {
            read("member", get(historyAssets()).param("q", query))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[0].id").value(assetId.toString()));
        }
        read("member", get(historyAssets()).param("q", "missing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value(org.hamcrest.Matchers.nullValue()));
        UUID empty = estate("owner");
        member(empty, "member", "COUNCIL");
        read("member", get("/estates/" + empty + "/asset-history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        assertEquals(1, page("member", historyAssets()).path("items").size());
    }

    @Test
    void searchNeverReturnsAnotherEstatesMatchingEquipment() throws Exception {
        UUID otherEstate = estate("other");
        member(otherEstate, "member", "COUNCIL");
        UUID location = location(otherEstate, "BLOCK", null, "Other block", null);
        UUID other = asset(otherEstate, location, "E-A0001", "Water pump");
        var local = body(read("member", get(historyAssets()).param("q", "pump")).andExpect(status().isOk()));
        assertEquals(List.of(assetId.toString()), values(local.path("items"), "id"));
        var foreign = body(
                read("member", get("/estates/" + otherEstate + "/asset-history").param("q", "pump"))
                        .andExpect(status().isOk()));
        assertEquals(List.of(other.toString()), values(foreign.path("items"), "id"));
    }

    @Test
    void listCursorBindsEstateNormalizedQueryAndStatus() throws Exception {
        UUID second = asset(estateId, locationId, "E-A0002", "Water pump");
        var first = body(read(
                        "member",
                        get(historyAssets())
                                .param("q", "pump")
                                .param("status", "ALL")
                                .param("limit", "1"))
                .andExpect(status().isOk()));
        String cursor = first.path("nextCursor").asText();
        read(
                        "member",
                        get(historyAssets())
                                .param("q", " pump ")
                                .param("status", "ALL")
                                .param("cursor", cursor))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(second.toString()));
        read(
                        "member",
                        get(historyAssets())
                                .param("q", "motor")
                                .param("status", "ALL")
                                .param("cursor", cursor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        read(
                        "member",
                        get(historyAssets())
                                .param("q", "pump")
                                .param("status", "ACTIVE")
                                .param("cursor", cursor))
                .andExpect(status().isBadRequest());
        UUID foreign = estate("owner");
        member(foreign, "member", "COUNCIL");
        read(
                        "member",
                        get("/estates/" + foreign + "/asset-history")
                                .param("q", "pump")
                                .param("status", "ALL")
                                .param("cursor", cursor))
                .andExpect(status().isBadRequest());
        read("member", get(history(assetId)).param("cursor", cursor)).andExpect(status().isBadRequest());
    }

    @Test
    void listUsesTwentyFiveItemDefaultAndAFiniteFinalPage() throws Exception {
        for (int i = 2; i <= 27; i++) asset(estateId, locationId, "E-A%04d".formatted(i), "Water pump");
        var first = page("member", historyAssets());
        assertEquals(25, first.path("items").size());
        var last = body(read(
                        "member",
                        get(historyAssets())
                                .param("cursor", first.path("nextCursor").asText()))
                .andExpect(status().isOk()));
        assertEquals(List.of("E-A0026", "E-A0027"), values(last.path("items"), "reference"));
        assertTrue(last.path("nextCursor").isNull());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101", "1.5", "invalid"})
    void bothReadEndpointsRejectInvalidPageLimits(String limit) throws Exception {
        for (String path : List.of(historyAssets(), history(assetId))) {
            read("member", get(path).param("limit", limit))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "100"})
    void bothReadEndpointsAcceptBoundaryPageLimits(String limit) throws Exception {
        for (String path : List.of(historyAssets(), history(assetId))) {
            read("member", get(path).param("limit", limit)).andExpect(status().isOk());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"not-a-cursor", "%%%%", "e30", "bm90LWEtdmVyc2lvbmVkLWN1cnNvcg"})
    void malformedCursorsHaveAVisibleBadRequestEnvelope(String cursor) throws Exception {
        for (String path : List.of(historyAssets(), history(assetId))) {
            read("member", get(path).param("cursor", cursor))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
    }

    @Test
    void timelineCursorCannotBeReusedForAnotherAssetEstateOrTheAssetList() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-02-01");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-01-01");
        var first =
                body(read("owner", get(history(assetId)).param("limit", "1")).andExpect(status().isOk()));
        String cursor = first.path("nextCursor").asText();
        UUID other = asset(estateId, locationId, "E-A0002", "Other pump");
        UUID foreign = estate("owner");
        UUID foreignLocation = location(foreign, "BLOCK", null, "Block B", null);
        UUID foreignAsset = asset(foreign, foreignLocation, "E-A0001", "Foreign pump");
        for (String path : List.of(
                history(other), historyAssets(), "/estates/" + foreign + "/assets/" + foreignAsset + "/history")) {
            read("owner", get(path).param("cursor", cursor))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
    }

    @Test
    void invalidSearchStatusAndPathValuesReturnBadRequests() throws Exception {
        for (String value : List.of("RETIRED", "invalid")) {
            read("member", get(historyAssets()).param("status", value)).andExpect(status().isBadRequest());
        }
        read("member", get(historyAssets()).param("q", "x".repeat(256))).andExpect(status().isBadRequest());
        read("member", get(historyAssets()).param("q", "x".repeat(255))).andExpect(status().isOk());
        for (String path : List.of(
                "/estates/not-a-uuid/asset-history",
                path() + "/assets/not-a-uuid/history",
                "/estates/not-a-uuid/assets/" + assetId + "/history")) {
            read("member", get(path))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
    }
}
