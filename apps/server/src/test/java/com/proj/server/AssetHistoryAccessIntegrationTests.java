package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AssetHistoryAccessIntegrationTests extends AssetHistoryTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"owner", "member"})
    void ownerAndCurrentCouncilCanReadTheTimelineAndBrowseAssets(String user) throws Exception {
        page(user, history(assetId));
        var assets = page(user, historyAssets());
        assertEquals(List.of(assetId.toString()), values(assets.path("items"), "id"));
        read(user, get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewAssetHistory").value(true))
                .andExpect(jsonPath("$.estates[0].canViewAssets").value(user.equals("owner")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"manager", "crew", "resident", "legacy-member"})
    void unrelatedEstateRolesAndForgedProviderAdminClaimsDoNotGrantHistory(String user) throws Exception {
        read(user, get(history(assetId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").isNotEmpty());
        read(user, get(historyAssets()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").isNotEmpty());
        read(user, get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewAssetHistory").value(false));
    }

    @Test
    void customDocumentAndEstatePermissionsDoNotImplicitlyGrantOwnerOrCouncilHistory() throws Exception {
        grant("other", "VIEW_ESTATE", "VIEW_DOCUMENTS", "EDIT_DOCUMENTS");
        read("other", get(history(assetId))).andExpect(status().isForbidden());
        read("other", get(historyAssets())).andExpect(status().isForbidden());
        read("other", get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewAssetHistory").value(false));
    }

    @Test
    void sameEstateResidentMembershipOverridesOwnership() throws Exception {
        db.execute(
                "update \"EstateUser\" set role='RESIDENT', \"canInviteMembers\"=false where \"estateId\"=? and \"userId\"='owner'",
                estateId);
        read("owner", get(history(assetId))).andExpect(status().isForbidden());
        read("owner", get(historyAssets())).andExpect(status().isForbidden());
        read("owner", get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewAssetHistory").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "member"})
    void retiredEquipmentAndInactiveEstatesKeepHistoryAndBrowsingReadable(String user) throws Exception {
        UUID repair = maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-01-01");
        db.execute("update \"Asset\" set \"deactivatedAt\"=now(), \"retiredOn\"='2026-09-01' where id=?", assetId);
        inactive();
        read(user, get(history(assetId)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.asset.status").value("RETIRED"))
                .andExpect(jsonPath("$.asset.retiredOn").value("2026-09-01"))
                .andExpect(jsonPath("$.items[0].sourceId").value(repair.toString()));
        page(user, historyAssets());
        read(user, get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewAssetHistory").value(true));
    }

    @Test
    void membershipRevocationIsRecheckedForBothCursorsAndCapabilities() throws Exception {
        maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-02-01");
        maintenance(UUID.randomUUID(), assetId, "PREVENTIVE", "2026-01-01");
        asset(estateId, locationId, "E-A0002", "Other pump");
        var history =
                body(read("member", get(history(assetId)).param("limit", "1")).andExpect(status().isOk()));
        var assets =
                body(read("member", get(historyAssets()).param("limit", "1")).andExpect(status().isOk()));
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='member'", estateId);
        read(
                        "member",
                        get(history(assetId))
                                .param("cursor", history.path("nextCursor").asText()))
                .andExpect(status().isNotFound());
        read(
                        "member",
                        get(historyAssets())
                                .param("cursor", assets.path("nextCursor").asText()))
                .andExpect(status().isNotFound());
        read("member", get("/access/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates").isEmpty());
    }

    @Test
    void foreignMissingAndInaccessibleResourcesAreNotExposed() throws Exception {
        UUID foreign = estate("other");
        UUID foreignLocation = location(foreign, "BLOCK", null, "Foreign block", null);
        UUID foreignAsset = asset(foreign, foreignLocation, "E-A0001", "Foreign pump");
        for (String path : List.of(
                history(foreignAsset),
                history(UUID.randomUUID()),
                "/estates/" + foreign + "/assets/" + assetId + "/history",
                "/estates/" + UUID.randomUUID() + "/asset-history")) {
            read("member", get(path))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.message").isNotEmpty());
        }
        read("outsider", get(history(assetId))).andExpect(status().isNotFound());
        read("outsider", get(historyAssets())).andExpect(status().isNotFound());
        read("other", get("/estates/" + foreign + "/assets/" + assetId + "/history"))
                .andExpect(status().isNotFound());
    }

    @Test
    void councilHistoryDoesNotGrantPrivateScreensOrAssetDocumentInspectionAndWorkOrderWrites() throws Exception {
        page("member", history(assetId));
        for (String suffix : List.of("", "/assessments", "/events")) {
            read("member", get(path() + "/assets/" + assetId + suffix)).andExpect(status().isNotFound());
        }
        for (String suffix : List.of("/documents", "/inspections")) {
            read("member", get(path() + "/assets/" + assetId + suffix)).andExpect(status().isForbidden());
        }
        UUID order = workOrder(estateId, assetId, locationId);
        read("member", get(path() + "/work-orders/" + order)).andExpect(status().isForbidden());
        send(
                        "member",
                        patch(path() + "/assets/" + assetId),
                        Map.of("name", "Changed", "locationId", locationId, "category", "PUMP"))
                .andExpect(status().isNotFound());
        send(
                        "member",
                        post(path() + "/assets/" + assetId + "/deactivate"),
                        Map.of(
                                "reference", "E-A0001",
                                "retiredOn", "2026-09-01",
                                "retirementReason", "Worn",
                                "expectedVersion", 0))
                .andExpect(status().isNotFound());
        send(
                        "member",
                        post(path() + "/assets/" + assetId + "/assessments"),
                        Map.of("condition", "GOOD", "assessedOn", "2026-09-01", "notes", "Checked"))
                .andExpect(status().isNotFound());
        send(
                        "member",
                        post(path() + "/assets/" + assetId + "/events"),
                        Map.of("type", "PREVENTIVE", "occurredOn", "2026-09-01", "notes", "Checked"))
                .andExpect(status().isNotFound());
        UUID document = document("INVOICE", null, null, "2026-01-01T02:00:00Z");
        send(
                        "member",
                        put(path() + "/documents/" + document + "/asset"),
                        Map.of("assetId", assetId, "expectedAssociationVersion", 0))
                .andExpect(status().isForbidden());
        send(
                        "member",
                        put(path() + "/work-orders/" + order + "/completion"),
                        Map.of("expectedVersion", 0, "findings", "Worn", "workPerformed", "Replaced"))
                .andExpect(status().isForbidden());
    }

    @Test
    void bothHistoryReadsRequireAuthentication() throws Exception {
        mvc.perform(get(history(assetId))).andExpect(status().isUnauthorized());
        mvc.perform(get(historyAssets())).andExpect(status().isUnauthorized());
    }
}
