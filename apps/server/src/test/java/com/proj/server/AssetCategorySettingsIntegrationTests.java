package com.proj.server;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Silent-failure asset categories (ID-83, spec silent-failure-categories.md). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetCategorySettingsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, locationId;

    @BeforeEach
    void setup() {
        estateId = estate("owner");
        locationId = location(estateId);
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
        when(workOS.findDisplayName("manager")).thenReturn(Optional.of("Morgan Lee"));
    }

    UUID estate(String owner) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, 'Estate', ?, 'Road', '123456', now())",
                id,
                owner,
                id.toString());
        return id;
    }

    UUID location(UUID estate) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                id,
                estate);
        return id;
    }

    void asset(UUID estate, UUID location, String category, boolean retired) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"deactivatedAt\", \"updatedAt\") values (?, ?, ?, ?, 'Asset', ?, ?::timestamptz, now())",
                id,
                estate,
                location,
                "R-" + id.toString().substring(0, 8),
                category,
                retired ? "2026-01-01T00:00:00Z" : null);
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions list(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/asset-categories").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions flag(String user, String category, String json) throws Exception {
        return flag(user, estateId, category, json);
    }

    ResultActions flag(String user, UUID estate, String category, String json) throws Exception {
        return mvc.perform(put("/estates/" + estate + "/asset-categories/" + category + "/silent-failure")
                .with(jwt().jwt(j -> j.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    static String to(boolean failsSilently) {
        return "{\"failsSilently\":" + failsSilently + "}";
    }

    /** The category's entry in the list. */
    static String in(String code, String field) {
        return "$.categories[?(@.code == '" + code + "')]." + field;
    }

    int changes() {
        return ((Number) db.fetchValue(
                        "select count(*) from \"AssetCategoryFlagChange\" where \"estateId\" = ?", estateId))
                .intValue();
    }

    @Test
    void listsEveryCategoryWithLightingFlaggedByDefaultAndFirst() throws Exception {
        var categories = ((Number) db.fetchValue("select count(*) from \"AssetCategory\"")).intValue();
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateActive").value(true))
                .andExpect(jsonPath("$.categories.length()").value(categories))
                .andExpect(jsonPath("$.categories[0].code").value("LIGHTING"))
                .andExpect(jsonPath("$.categories[0].label").value("Lighting"))
                .andExpect(jsonPath("$.categories[0].failsSilently").value(true))
                .andExpect(jsonPath("$.categories[0].isDefault").value(true))
                .andExpect(jsonPath("$.categories[0].lastChange").value(nullValue()))
                .andExpect(jsonPath("$.categories[1].failsSilently").value(false))
                .andExpect(jsonPath(in("PUMP", "failsSilently")).value(false))
                .andExpect(jsonPath(in("PUMP", "isDefault")).value(true));
    }

    @Test
    void countsOnlyTheEstatesActiveAssetsOfEachCategory() throws Exception {
        asset(estateId, locationId, "PUMP", false);
        asset(estateId, locationId, "PUMP", false);
        asset(estateId, locationId, "PUMP", true);
        asset(estateId, locationId, "LIGHTING", false);
        var other = estate("owner");
        asset(other, location(other), "PUMP", false);
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath(in("PUMP", "activeAssetCount")).value(2))
                .andExpect(jsonPath(in("LIGHTING", "activeAssetCount")).value(1))
                .andExpect(jsonPath("$.categories[-1].activeAssetCount").value(0));
    }

    @Test
    void flaggingRecordsWhoChangedItAndWhen() throws Exception {
        flag("owner", "PUMP", to(true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PUMP"))
                .andExpect(jsonPath("$.failsSilently").value(true))
                .andExpect(jsonPath("$.isDefault").value(false))
                .andExpect(jsonPath("$.lastChange.failsSilently").value(true))
                .andExpect(jsonPath("$.lastChange.changedByUserId").value("owner"))
                .andExpect(jsonPath("$.lastChange.changedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.lastChange.changedAt").isNotEmpty());
        list("owner")
                .andExpect(jsonPath("$.categories[0].code").value("LIGHTING"))
                .andExpect(jsonPath("$.categories[1].code").value("PUMP"))
                .andExpect(jsonPath("$.categories[1].lastChange.changedByName").value("Casey Doe"));
        assertEquals(1, changes());
    }

    @Test
    void unflaggingLightingReplacesItsDefault() throws Exception {
        flag("owner", "LIGHTING", to(false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failsSilently").value(false))
                .andExpect(jsonPath("$.isDefault").value(false));
        list("owner").andExpect(jsonPath(in("LIGHTING", "failsSilently")).value(false));
        assertEquals(1, changes());
    }

    @Test
    void settingTheCurrentValueRecordsNothing() throws Exception {
        flag("owner", "LIGHTING", to(true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failsSilently").value(true))
                .andExpect(jsonPath("$.isDefault").value(true))
                .andExpect(jsonPath("$.lastChange").value(nullValue()));
        flag("owner", "PUMP", to(true)).andExpect(status().isOk());
        flag("owner", "PUMP", to(true)).andExpect(status().isOk());
        assertEquals(1, changes());
    }

    @Test
    void theLatestChangeWins() throws Exception {
        db.execute(
                "insert into \"AssetCategoryFlagChange\" (id, \"estateId\", category, \"failsSilently\", \"changedByUserId\", \"changedAt\") values (?, ?, 'PUMP', true, 'owner', '2026-01-01T00:00:00Z'), (?, ?, 'PUMP', false, 'manager', '2026-02-01T00:00:00Z')",
                UUID.randomUUID(),
                estateId,
                UUID.randomUUID(),
                estateId);
        list("owner")
                .andExpect(jsonPath(in("PUMP", "failsSilently")).value(false))
                .andExpect(jsonPath(in("PUMP", "isDefault")).value(false))
                .andExpect(jsonPath(in("PUMP", "lastChange.changedByUserId")).value("manager"));
    }

    @Test
    void flagsBelongToOneEstate() throws Exception {
        var other = estate("owner");
        flag("owner", "PUMP", to(true)).andExpect(status().isOk());
        mvc.perform(get("/estates/" + other + "/asset-categories").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath(in("PUMP", "failsSilently")).value(false))
                .andExpect(jsonPath(in("PUMP", "isDefault")).value(true));
    }

    @Test
    void anAssignedManagerCanReadAndChangeFlags() throws Exception {
        membership("manager", "MANAGER");
        list("manager").andExpect(status().isOk());
        flag("manager", "PUMP", to(true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastChange.changedByUserId").value("manager"))
                .andExpect(jsonPath("$.lastChange.changedByName").value("Morgan Lee"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "MEMBER"})
    void otherEstateRolesFindNothing(String role) throws Exception {
        membership("staff", role);
        list("staff").andExpect(status().isNotFound());
        flag("staff", "PUMP", to(true)).andExpect(status().isNotFound());
        assertEquals(0, changes());
    }

    @Test
    void strangersFindNothingAndResidentsAreRefused() throws Exception {
        list("stranger").andExpect(status().isNotFound());
        flag("stranger", "PUMP", to(true)).andExpect(status().isNotFound());
        membership("resident", "RESIDENT");
        list("resident").andExpect(status().isForbidden());
        flag("resident", "PUMP", to(true)).andExpect(status().isForbidden());
        assertEquals(0, changes());
    }

    @Test
    void anInactiveEstateIsReadOnly() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateActive").value(false));
        flag("owner", "PUMP", to(true))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, changes());
    }

    @Test
    void anUnknownCategoryIsNotFound() throws Exception {
        flag("owner", "TELEPORTER", to(true))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"failsSilently\":null}", "{\"failsSilently\":\"true\"}", "{\"failsSilently\":1}"})
    void rejectsAMissingOrNonBooleanFlag(String json) throws Exception {
        flag("owner", "PUMP", json)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, changes());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/asset-categories")).andExpect(status().isUnauthorized());
        mvc.perform(put("/estates/" + estateId + "/asset-categories/PUMP/silent-failure")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(to(true)))
                .andExpect(status().isUnauthorized());
    }
}
