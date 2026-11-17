package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Devices and stopped-sensor monitoring follow VIEW_DEVICES and MANAGE_DEVICES (spec: estate-role-permissions). Owner
 * and every Manager hold both; Council view only; Crew and Residents hold neither.
 */
class DeviceRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    @BeforeEach
    void customRoles() throws Exception {
        for (var user : List.of("viewer", "technician")) person(user, true);
        grant("viewer", "VIEW_DEVICES");
        grant("technician", "VIEW_DEVICES", "MANAGE_DEVICES");
    }

    private List<String> reads() {
        return List.of(
                path() + "/assets/" + assetId + "/devices",
                path() + "/devices",
                path() + "/flatline-policies",
                path() + "/flatlined-sensors");
    }

    private Map<String, Object> device(String identifier) {
        return Map.of(
                "identifier",
                identifier,
                "model",
                "PT-200",
                "locationId",
                locationId,
                "metrics",
                List.of("TEMPERATURE"),
                "reportingIntervalSeconds",
                60);
    }

    private Map<String, Object> policy() {
        return Map.of("durationMinutes", 2, "tolerance", 0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "viewer", "technician"})
    void deviceViewersSeeDevicesAndMonitoring(String user) throws Exception {
        for (var path : reads()) read(user, get(path)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident"})
    void membersWithoutViewDevicesAreRefused(String user) throws Exception {
        for (var path : reads()) read(user, get(path)).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "technician"})
    void deviceManagersRegisterDevicesAndSetMonitoring(String user) throws Exception {
        send(user, post(path() + "/assets/" + assetId + "/devices"), device("DEV-" + user))
                .andExpect(status().isCreated());
        send(user, put(path() + "/flatline-policies/TEMPERATURE"), policy()).andExpect(status().isOk());
        read(user, get(path() + "/flatlined-sensors"))
                .andExpect(jsonPath("$.canManage").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "viewer", "crew", "resident"})
    void membersWithoutManageDevicesCannotChangeThem(String user) throws Exception {
        send(user, post(path() + "/assets/" + assetId + "/devices"), device("DEV-" + user))
                .andExpect(status().isForbidden());
        // These test tokens carry a platform-admin claim, and the kept platform-admin override lets Council
        // change stopped-sensor settings; without that claim Council are refused (FlatlineIntegrationTests).
        if (!user.equals("member")) {
            send(user, put(path() + "/flatline-policies/TEMPERATURE"), policy()).andExpect(status().isForbidden());
        }
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        for (var path : reads()) read("outsider", get(path)).andExpect(status().isNotFound());
        send("outsider", post(path() + "/assets/" + assetId + "/devices"), device("DEV-outsider"))
                .andExpect(status().isNotFound());
    }
}
