package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Maintenance records, failure risk and asset completions follow VIEW_ASSETS / EDIT_ASSETS; cost views follow
 * VIEW_COSTS (spec: estate-role-permissions).
 */
class MaintenanceCostRiskPermissionsIntegrationTests extends AssetHistoryTestSupport {
    @BeforeEach
    void customRoles() throws Exception {
        for (var user : List.of("viewer", "editor", "costs")) person(user, true);
        grant("viewer", "VIEW_ASSETS");
        grant("editor", "VIEW_ASSETS", "EDIT_ASSETS");
        grant("costs", "VIEW_ASSETS", "VIEW_COSTS");
    }

    private List<String> assetReads() {
        var asset = path() + "/assets/" + assetId;
        return List.of(
                asset + "/events",
                asset + "/failure-risk",
                path() + "/failure-risk",
                asset + "/work-order-completions");
    }

    private List<String> costReads() {
        return List.of(path() + "/costs/top-assets", path() + "/costs/forecast");
    }

    private Map<String, Object> maintenance() {
        return Map.of("type", "PREVENTIVE", "occurredOn", "2026-09-01", "notes", "Routine service");
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "viewer"})
    void assetViewersReadMaintenanceRiskAndCompletions(String user) throws Exception {
        for (var path : assetReads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident"})
    void membersWithoutViewAssetsCannotReadMaintenanceRiskOrCompletions(String user) throws Exception {
        for (var path : assetReads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "editor"})
    void assetEditorsRecordMaintenance(String user) throws Exception {
        send(user, post(path() + "/assets/" + assetId + "/events"), maintenance())
                .andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {"viewer", "crew", "resident"})
    void membersWithoutEditAssetsCannotRecordMaintenance(String user) throws Exception {
        send(user, post(path() + "/assets/" + assetId + "/events"), maintenance())
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "costs"})
    void costViewersReadTheCostCards(String user) throws Exception {
        for (var path : costReads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"viewer", "crew", "resident"})
    void membersWithoutViewCostsCannotReadCosts(String user) throws Exception {
        for (var path : costReads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        for (var path : assetReads()) read("outsider", get(path)).andExpect(status().isNotFound());
        for (var path : costReads()) read("outsider", get(path)).andExpect(status().isNotFound());
        send("outsider", post(path() + "/assets/" + assetId + "/events"), maintenance())
                .andExpect(status().isNotFound());
    }

    @Test
    void maintenanceCannotBeRecordedInAnInactiveEstate() throws Exception {
        inactive();
        send("member", post(path() + "/assets/" + assetId + "/events"), maintenance())
                .andExpect(status().isConflict());
    }
}
