package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Adding locations and floors needs CREATE_LOCATIONS; renaming, moving, deactivating and listing inactive locations
 * need EDIT_LOCATIONS; asset viewers (VIEW_ASSETS) also list inactive locations (spec: estate-role-permissions). The owner and every Manager hold both.
 */
class LocationRolePermissionsIntegrationTests extends AssetHistoryTestSupport {
    UUID levelId;

    @BeforeEach
    void level() {
        levelId = location(estateId, "LEVEL", locationId, "L1", 1);
    }

    private Map<String, Object> floors() {
        return Map.of("lowestFloor", 2, "highestFloor", 3);
    }

    private Map<String, Object> rename() {
        var body = new HashMap<String, Object>();
        body.put("name", "Level one");
        body.put("parentId", locationId);
        body.put("sortOrder", 1);
        return body;
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager"})
    void ownersAndManagersAddFloorsEditDeactivateAndSeeInactiveLocations(String user) throws Exception {
        send(user, post(path() + "/locations/" + locationId + "/floors"), floors())
                .andExpect(status().isOk());
        send(user, patch(path() + "/locations/" + levelId), rename()).andExpect(status().isOk());
        read(user, post(path() + "/locations/" + levelId + "/deactivate")).andExpect(status().isOk());
        read(user, get(path() + "/locations?includeInactive=true")).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "crew"})
    void councilAndCrewCannotChangeLocations(String user) throws Exception {
        send(user, post(path() + "/locations/" + locationId + "/floors"), floors())
                .andExpect(status().isForbidden());
        send(user, patch(path() + "/locations/" + levelId), rename()).andExpect(status().isForbidden());
        read(user, post(path() + "/locations/" + levelId + "/deactivate")).andExpect(status().isForbidden());
        // Report responders (Crew) keep the full list for historical report locations, and asset viewers
        // (Council) for assets in deactivated locations on the register.
        read(user, get(path() + "/locations?includeInactive=true")).andExpect(status().isOk());
    }

    @Test
    void membersWithoutAssetsOrLocationEditingCannotListInactiveLocations() throws Exception {
        person("estate-viewer", true);
        grant("estate-viewer", "VIEW_ESTATE");
        person("asset-viewer", true);
        grant("asset-viewer", "VIEW_ESTATE", "VIEW_ASSETS");
        read("estate-viewer", get(path() + "/locations?includeInactive=true")).andExpect(status().isForbidden());
        read("estate-viewer", get(path() + "/locations")).andExpect(status().isOk());
        read("asset-viewer", get(path() + "/locations?includeInactive=true")).andExpect(status().isOk());
    }

    @Test
    void nonMembersFindNothing() throws Exception {
        send("outsider", post(path() + "/locations/" + locationId + "/floors"), floors())
                .andExpect(status().isNotFound());
        read("outsider", post(path() + "/locations/" + levelId + "/deactivate")).andExpect(status().isNotFound());
    }
}
