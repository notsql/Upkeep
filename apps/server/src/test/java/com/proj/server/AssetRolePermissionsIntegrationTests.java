package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Assets follow VIEW_ASSETS and EDIT_ASSETS (spec: estate-role-permissions). Owner, every Manager and Council hold
 * both; Crew, Residents and custom roles without them are refused; non-members find nothing.
 */
class AssetRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    @BeforeEach
    void customRoles() throws Exception {
        for (var user : List.of("viewer", "editor", "estate-viewer")) person(user, true);
        grant("viewer", "VIEW_ESTATE", "VIEW_ASSETS");
        grant("editor", "VIEW_ESTATE", "VIEW_ASSETS", "EDIT_ASSETS");
        grant("estate-viewer", "VIEW_ESTATE");
    }

    private List<String> reads() {
        var asset = path() + "/assets/" + assetId;
        return List.of(path() + "/assets", asset, asset + "/lifecycle-events", asset + "/history", historyAssets());
    }

    private Map<String, Object> newAsset() {
        return Map.of("name", "Booster pump", "category", "PUMP", "locationId", locationId);
    }

    private Map<String, Object> changedAsset() {
        return Map.of("name", "Renamed pump", "category", "PUMP", "locationId", locationId);
    }

    private Map<String, Object> retirement() {
        var body = new HashMap<String, Object>();
        body.put("reference", "E-A0001");
        body.put("retiredOn", "2026-09-01");
        body.put("retirementReason", "Worn");
        body.put("expectedVersion", 0);
        return body;
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "viewer", "editor"})
    void assetViewersCanReadTheRegisterDetailAndHistory(String user) throws Exception {
        for (var path : reads()) {
            read(user, get(path)).andExpect(status().isOk());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident", "estate-viewer"})
    void membersWithoutViewAssetsAreRefused(String user) throws Exception {
        for (var path : reads()) {
            read(user, get(path)).andExpect(status().isForbidden());
        }
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        for (var path : reads()) {
            read("outsider", get(path)).andExpect(status().isNotFound());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "editor"})
    void assetEditorsCanAddEditAndRetireAssets(String user) throws Exception {
        send(user, post(path() + "/assets"), newAsset()).andExpect(status().isCreated());
        send(user, patch(path() + "/assets/" + assetId), changedAsset()).andExpect(status().isOk());
        send(user, post(path() + "/assets/" + assetId + "/deactivate"), retirement())
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"viewer", "crew", "resident", "estate-viewer"})
    void membersWithoutEditAssetsCannotChangeAssets(String user) throws Exception {
        send(user, post(path() + "/assets"), newAsset()).andExpect(status().isForbidden());
        send(user, patch(path() + "/assets/" + assetId), changedAsset()).andExpect(status().isForbidden());
        send(user, post(path() + "/assets/" + assetId + "/deactivate"), retirement())
                .andExpect(status().isForbidden());
    }

    @Test
    void nonMembersCannotChangeAssets() throws Exception {
        send("outsider", post(path() + "/assets"), newAsset()).andExpect(status().isNotFound());
        send("outsider", patch(path() + "/assets/" + assetId), changedAsset()).andExpect(status().isNotFound());
    }

    @Test
    void assetsCannotChangeInAnInactiveEstate() throws Exception {
        inactive();
        send("manager", post(path() + "/assets"), newAsset()).andExpect(status().isConflict());
        send("member", patch(path() + "/assets/" + assetId), changedAsset()).andExpect(status().isConflict());
        read("manager", get(path() + "/assets")).andExpect(status().isOk());
    }

    // Linking a document to an asset needs EDIT_ASSETS; reading the link needs VIEW_ASSETS (plus documents).
    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member"})
    void assetEditorsWithDocumentsLinkDocumentsToAssets(String user) throws Exception {
        var document = document("INVOICE", null, null, "2026-01-01T02:00:00Z");
        send(
                        user,
                        put(path() + "/documents/" + document + "/asset"),
                        Map.of("assetId", assetId, "expectedAssociationVersion", 0))
                .andExpect(status().isOk());
        read(user, get(path() + "/assets/" + assetId + "/documents")).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "viewer"})
    void othersCannotLinkDocumentsToAssets(String user) throws Exception {
        var document = document("INVOICE", null, null, "2026-01-01T02:00:00Z");
        send(
                        user,
                        put(path() + "/documents/" + document + "/asset"),
                        Map.of("assetId", assetId, "expectedAssociationVersion", 0))
                .andExpect(status().isForbidden());
    }
}
