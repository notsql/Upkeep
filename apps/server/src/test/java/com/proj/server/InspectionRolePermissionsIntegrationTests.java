package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Inspections follow VIEW_INSPECTIONS, RECORD_INSPECTIONS and MANAGE_INSPECTIONS; category and service-interval reads
 * follow VIEW_ASSETS (spec: estate-role-permissions).
 */
class InspectionRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    @BeforeEach
    void customRoles() throws Exception {
        for (var user : List.of("inspection-viewer", "scheduler")) person(user, true);
        grant("inspection-viewer", "VIEW_INSPECTIONS");
        grant("scheduler", "VIEW_INSPECTIONS", "MANAGE_INSPECTIONS");
    }

    private List<String> inspectionReads() {
        return List.of(
                path() + "/inspection-list",
                path() + "/inspectors",
                path() + "/inspection-assets",
                path() + "/assets/" + assetId + "/inspections");
    }

    private List<String> scheduleReads() {
        return List.of(path() + "/asset-categories", path() + "/assets/" + assetId + "/service-interval");
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew", "inspection-viewer", "scheduler"})
    void inspectionViewersSeeResultsTheDueListAndInspectors(String user) throws Exception {
        for (var path : inspectionReads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "resident"})
    void membersWithoutViewInspectionsAreRefused(String user) throws Exception {
        for (var path : inspectionReads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "scheduler"})
    void inspectionManagersGenerateTheDueListAndChangeSchedules(String user) throws Exception {
        read(user, post(path() + "/inspection-list/generate")).andExpect(status().is2xxSuccessful());
        send(user, put(path() + "/asset-categories/PUMP/silent-failure"), Map.of("failsSilently", true))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "inspection-viewer", "member"})
    void membersWithoutManageInspectionsCannotChangeSchedules(String user) throws Exception {
        read(user, post(path() + "/inspection-list/generate")).andExpect(status().isForbidden());
        send(user, put(path() + "/asset-categories/PUMP/silent-failure"), Map.of("failsSilently", true))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member"})
    void assetViewersReadCategoriesAndServiceIntervals(String user) throws Exception {
        for (var path : scheduleReads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident"})
    void membersWithoutViewAssetsCannotReadCategories(String user) throws Exception {
        for (var path : scheduleReads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        for (var path : inspectionReads()) read("outsider", get(path)).andExpect(status().isNotFound());
        for (var path : scheduleReads()) read("outsider", get(path)).andExpect(status().isNotFound());
    }
}
