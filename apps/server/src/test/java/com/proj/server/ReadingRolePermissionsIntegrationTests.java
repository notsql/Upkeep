package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Readings follow VIEW_READINGS, RECORD_READINGS and IMPORT_READINGS (spec: estate-role-permissions). Owner and every
 * Manager hold all three; Crew view and record; Council and Residents hold none.
 */
class ReadingRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    @BeforeEach
    void customRoles() throws Exception {
        for (var user : List.of("viewer", "recorder", "importer")) person(user, true);
        grant("viewer", "VIEW_READINGS");
        grant("recorder", "VIEW_READINGS", "RECORD_READINGS");
        grant("importer", "VIEW_READINGS", "IMPORT_READINGS");
    }

    private List<String> reads() {
        var asset = path() + "/assets/" + assetId;
        return List.of(
                path() + "/readings",
                path() + "/readings/assets",
                path() + "/readings/metrics",
                asset + "/readings",
                asset + "/readings/grouped",
                asset + "/readings/series?from=2026-10-01T00:00:00Z&to=2026-10-01T01:00:00Z",
                asset + "/assessments");
    }

    private String manual() {
        return """
                {"assetId":"%s","metric":"TEMPERATURE","value":21,"unit":"°C","measuredAt":"2026-10-01T08:00:00Z","submissionId":"%s"}
                """.formatted(assetId, UUID.randomUUID());
    }

    private Map<String, Object> assessment() {
        return Map.of("condition", "GOOD", "assessedOn", "2026-09-01", "notes", "Checked");
    }

    private org.springframework.test.web.servlet.ResultActions record(String user) throws Exception {
        return mvc.perform(as(
                user,
                post(path() + "/readings/manual")
                        .contentType("application/json")
                        .content(manual())));
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew", "viewer"})
    void readingViewersReadEstateAndAssetReadings(String user) throws Exception {
        for (var path : reads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "resident", "legacy-member"})
    void membersWithoutViewReadingsAreRefused(String user) throws Exception {
        for (var path : reads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew", "recorder"})
    void readingRecordersRecordReadingsAndAssessments(String user) throws Exception {
        record(user).andExpect(status().isCreated());
        send(user, post(path() + "/assets/" + assetId + "/assessments"), assessment())
                .andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {"viewer", "importer", "member", "resident"})
    void membersWithoutRecordReadingsCannotRecord(String user) throws Exception {
        record(user).andExpect(status().isForbidden());
        send(user, post(path() + "/assets/" + assetId + "/assessments"), assessment())
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "importer"})
    void readingImportersSeeImports(String user) throws Exception {
        read(user, get(path() + "/readings/imports")).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "viewer", "recorder", "member"})
    void membersWithoutImportReadingsCannotSeeImports(String user) throws Exception {
        read(user, get(path() + "/readings/imports")).andExpect(status().isForbidden());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        for (var path : reads()) read("outsider", get(path)).andExpect(status().isNotFound());
        record("outsider").andExpect(status().isNotFound());
        read("outsider", get(path() + "/readings/imports")).andExpect(status().isNotFound());
    }
}
