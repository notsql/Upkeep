package com.proj.server;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
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
import org.junit.jupiter.params.provider.CsvSource;
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

/** Manufacturer service intervals per category and per asset (ID-81, spec service-intervals.md). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ServiceIntervalIntegrationTests {
    static final String CLEAR = "{\"interval\":null}";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, locationId, assetId;

    @BeforeEach
    void setup() {
        estateId = estate("owner");
        locationId = location(estateId);
        assetId = asset(estateId, locationId, "PUMP");
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

    UUID asset(UUID estate, UUID location, String category) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, ?, 'Asset', ?, now())",
                id,
                estate,
                location,
                "R-" + id.toString().substring(0, 8),
                category);
        return id;
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions list(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/asset-categories").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions setCategory(String user, String category, String json) throws Exception {
        return mvc.perform(put("/estates/" + estateId + "/asset-categories/" + category + "/service-interval")
                .with(jwt().jwt(j -> j.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    ResultActions getAsset(String user, UUID asset) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/assets/" + asset + "/service-interval")
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions setAsset(String user, UUID asset, String json) throws Exception {
        return mvc.perform(put("/estates/" + estateId + "/assets/" + asset + "/service-interval")
                .with(jwt().jwt(j -> j.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    static String every(int value, String unit) {
        return "{\"interval\":{\"value\":" + value + ",\"unit\":\"" + unit + "\"}}";
    }

    /** The category's entry in the list. */
    static String in(String code, String field) {
        return "$.categories[?(@.code == '" + code + "')]." + field;
    }

    int categoryChanges() {
        return ((Number) db.fetchValue(
                        "select count(*) from \"AssetCategoryIntervalChange\" where \"estateId\" = ?", estateId))
                .intValue();
    }

    int assetChanges() {
        return ((Number) db.fetchValue("select count(*) from \"AssetIntervalChange\"")).intValue();
    }

    @Test
    void categoriesStartWithNoInterval() throws Exception {
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath(in("PUMP", "serviceInterval")).value(contains(nullValue())))
                .andExpect(jsonPath(in("PUMP", "lastIntervalChange")).value(contains(nullValue())))
                .andExpect(jsonPath("$.categories[0].code").value("LIGHTING"));
    }

    @Test
    void settingACategoryIntervalRecordsWhoChangedItAndWhen() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PUMP"))
                .andExpect(jsonPath("$.failsSilently").value(false))
                .andExpect(jsonPath("$.activeAssetCount").value(1))
                .andExpect(jsonPath("$.serviceInterval.value").value(6))
                .andExpect(jsonPath("$.serviceInterval.unit").value("MONTH"))
                .andExpect(jsonPath("$.lastIntervalChange.interval.value").value(6))
                .andExpect(jsonPath("$.lastIntervalChange.interval.unit").value("MONTH"))
                .andExpect(jsonPath("$.lastIntervalChange.changedByUserId").value("owner"))
                .andExpect(jsonPath("$.lastIntervalChange.changedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.lastIntervalChange.changedAt").isNotEmpty());
        list("owner")
                .andExpect(jsonPath(in("PUMP", "serviceInterval.value")).value(6))
                .andExpect(jsonPath(in("PUMP", "serviceInterval.unit")).value("MONTH"))
                .andExpect(
                        jsonPath(in("PUMP", "lastIntervalChange.changedByName")).value("Casey Doe"));
        assertEquals(1, categoryChanges());
    }

    @Test
    void unitsAreStoredAsEntered() throws Exception {
        setCategory("owner", "PUMP", every(12, "MONTH")).andExpect(status().isOk());
        setCategory("owner", "PUMP", every(1, "YEAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceInterval.value").value(1))
                .andExpect(jsonPath("$.serviceInterval.unit").value("YEAR"));
        setCategory("owner", "PUMP", every(14, "DAY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceInterval.value").value(14))
                .andExpect(jsonPath("$.serviceInterval.unit").value("DAY"));
        assertEquals(3, categoryChanges());
    }

    @Test
    void clearingACategoryIntervalRecordsTheChange() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setCategory("owner", "PUMP", CLEAR)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceInterval").value(nullValue()))
                .andExpect(jsonPath("$.lastIntervalChange.interval").value(nullValue()));
        assertEquals(2, categoryChanges());
    }

    @Test
    void settingTheCurrentCategoryIntervalRecordsNothing() throws Exception {
        setCategory("owner", "PUMP", CLEAR)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastIntervalChange").value(nullValue()));
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        assertEquals(1, categoryChanges());
    }

    @Test
    void theLatestCategoryChangeWins() throws Exception {
        db.execute(
                "insert into \"AssetCategoryIntervalChange\" (id, \"estateId\", category, \"intervalValue\", \"intervalUnit\", \"changedByUserId\", \"changedAt\") values (?, ?, 'PUMP', 6, 'MONTH', 'owner', '2026-01-01T00:00:00Z'), (?, ?, 'PUMP', 2, 'YEAR', 'manager', '2026-02-01T00:00:00Z')",
                UUID.randomUUID(),
                estateId,
                UUID.randomUUID(),
                estateId);
        list("owner")
                .andExpect(jsonPath(in("PUMP", "serviceInterval.value")).value(2))
                .andExpect(jsonPath(in("PUMP", "serviceInterval.unit")).value("YEAR"))
                .andExpect(jsonPath(in("PUMP", "lastIntervalChange.changedByUserId"))
                        .value("manager"));
    }

    @Test
    void categoryIntervalsBelongToOneEstate() throws Exception {
        var other = estate("owner");
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        mvc.perform(get("/estates/" + other + "/asset-categories").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(jsonPath(in("PUMP", "serviceInterval")).value(contains(nullValue())));
    }

    @Test
    void flagChangesAlsoReturnTheInterval() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        mvc.perform(put("/estates/" + estateId + "/asset-categories/PUMP/silent-failure")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"failsSilently\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failsSilently").value(true))
                .andExpect(jsonPath("$.serviceInterval.value").value(6));
    }

    @Test
    void anUnknownCategoryIsNotFound() throws Exception {
        setCategory("owner", "TELEPORTER", every(6, "MONTH"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void anAssetStartsWithNoInterval() throws Exception {
        getAsset("owner", assetId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effective").value(nullValue()))
                .andExpect(jsonPath("$.source").value("NONE"))
                .andExpect(jsonPath("$.override").value(nullValue()))
                .andExpect(jsonPath("$.categoryInterval").value(nullValue()))
                .andExpect(jsonPath("$.categoryLabel").value("Pump"))
                .andExpect(jsonPath("$.lastOverrideChange").value(nullValue()));
    }

    @Test
    void anAssetTakesItsCategorysInterval() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        getAsset("owner", assetId)
                .andExpect(jsonPath("$.effective.value").value(6))
                .andExpect(jsonPath("$.effective.unit").value("MONTH"))
                .andExpect(jsonPath("$.source").value("CATEGORY"))
                .andExpect(jsonPath("$.categoryInterval.value").value(6));
    }

    @Test
    void anOverrideWinsAndRecordsWhoChangedItAndWhen() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, every(90, "DAY"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effective.value").value(90))
                .andExpect(jsonPath("$.effective.unit").value("DAY"))
                .andExpect(jsonPath("$.source").value("ASSET"))
                .andExpect(jsonPath("$.override.value").value(90))
                .andExpect(jsonPath("$.override.unit").value("DAY"))
                .andExpect(jsonPath("$.categoryInterval.unit").value("MONTH"))
                .andExpect(jsonPath("$.lastOverrideChange.interval.value").value(90))
                .andExpect(jsonPath("$.lastOverrideChange.changedByUserId").value("owner"))
                .andExpect(jsonPath("$.lastOverrideChange.changedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.lastOverrideChange.changedAt").isNotEmpty());
        assertEquals(1, assetChanges());
    }

    @Test
    void removingAnOverrideFallsBackToTheCategory() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, every(3, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, CLEAR)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.effective.value").value(6))
                .andExpect(jsonPath("$.source").value("CATEGORY"))
                .andExpect(jsonPath("$.override").value(nullValue()))
                .andExpect(jsonPath("$.lastOverrideChange.interval").value(nullValue()));
        assertEquals(2, assetChanges());
    }

    @Test
    void settingTheCurrentOverrideRecordsNothing() throws Exception {
        setAsset("owner", assetId, CLEAR).andExpect(status().isOk());
        setAsset("owner", assetId, every(3, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, every(3, "MONTH")).andExpect(status().isOk());
        assertEquals(1, assetChanges());
    }

    @Test
    void anOverrideEqualToTheCategoryStaysWhenTheCategoryChanges() throws Exception {
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, every(6, "MONTH")).andExpect(status().isOk());
        setCategory("owner", "PUMP", every(1, "YEAR")).andExpect(status().isOk());
        getAsset("owner", assetId)
                .andExpect(jsonPath("$.effective.value").value(6))
                .andExpect(jsonPath("$.effective.unit").value("MONTH"))
                .andExpect(jsonPath("$.source").value("ASSET"))
                .andExpect(jsonPath("$.categoryInterval.unit").value("YEAR"));
    }

    @Test
    void clearingTheCategoryKeepsOverrides() throws Exception {
        var other = asset(estateId, locationId, "PUMP");
        setCategory("owner", "PUMP", every(6, "MONTH")).andExpect(status().isOk());
        setAsset("owner", assetId, every(3, "MONTH")).andExpect(status().isOk());
        setCategory("owner", "PUMP", CLEAR).andExpect(status().isOk());
        getAsset("owner", assetId).andExpect(jsonPath("$.source").value("ASSET"));
        getAsset("owner", other)
                .andExpect(jsonPath("$.effective").value(nullValue()))
                .andExpect(jsonPath("$.source").value("NONE"));
    }

    @Test
    void anAssignedManagerCanReadAndChangeIntervals() throws Exception {
        membership("manager", "MANAGER");
        setCategory("manager", "PUMP", every(6, "MONTH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastIntervalChange.changedByName").value("Morgan Lee"));
        getAsset("manager", assetId).andExpect(status().isOk());
        setAsset("manager", assetId, every(3, "MONTH"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastOverrideChange.changedByUserId").value("manager"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "MEMBER"})
    void otherEstateRolesFindNothing(String role) throws Exception {
        membership("staff", role);
        setCategory("staff", "PUMP", every(6, "MONTH")).andExpect(status().isNotFound());
        getAsset("staff", assetId).andExpect(status().isNotFound());
        setAsset("staff", assetId, every(3, "MONTH")).andExpect(status().isNotFound());
        assertEquals(0, categoryChanges() + assetChanges());
    }

    @Test
    void strangersFindNothingAndResidentsAreRefused() throws Exception {
        setCategory("stranger", "PUMP", every(6, "MONTH")).andExpect(status().isNotFound());
        getAsset("stranger", assetId).andExpect(status().isNotFound());
        setAsset("stranger", assetId, every(3, "MONTH")).andExpect(status().isNotFound());
        membership("resident", "RESIDENT");
        setCategory("resident", "PUMP", every(6, "MONTH")).andExpect(status().isForbidden());
        getAsset("resident", assetId).andExpect(status().isForbidden());
        setAsset("resident", assetId, every(3, "MONTH")).andExpect(status().isForbidden());
        assertEquals(0, categoryChanges() + assetChanges());
    }

    @Test
    void anotherEstatesAssetIsNotFound() throws Exception {
        var other = estate("owner");
        var foreign = asset(other, location(other), "PUMP");
        getAsset("owner", foreign).andExpect(status().isNotFound());
        setAsset("owner", foreign, every(3, "MONTH")).andExpect(status().isNotFound());
        getAsset("owner", UUID.randomUUID()).andExpect(status().isNotFound());
        assertEquals(0, assetChanges());
    }

    @Test
    void anInactiveEstateIsReadOnly() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        list("owner").andExpect(status().isOk());
        getAsset("owner", assetId).andExpect(status().isOk());
        setCategory("owner", "PUMP", every(6, "MONTH"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
        setAsset("owner", assetId, every(3, "MONTH"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, categoryChanges() + assetChanges());
    }

    @ParameterizedTest
    @ValueSource(strings = {"deactivated", "retired"})
    void aDeactivatedOrRetiredAssetIsReadOnly(String state) throws Exception {
        db.execute(
                "retired".equals(state)
                        ? "update \"Asset\" set \"deactivatedAt\" = now(), \"retiredOn\" = current_date where id = ?"
                        : "update \"Asset\" set \"deactivatedAt\" = now() where id = ?",
                assetId);
        getAsset("owner", assetId).andExpect(status().isOk());
        setAsset("owner", assetId, every(3, "MONTH"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, assetChanges());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"interval\":6}",
                "{\"interval\":{\"value\":6}}",
                "{\"interval\":{\"unit\":\"MONTH\"}}",
                "{\"interval\":{\"value\":6,\"unit\":\"WEEK\"}}",
                "{\"interval\":{\"value\":6,\"unit\":\"month\"}}",
                "{\"interval\":{\"value\":\"6\",\"unit\":\"MONTH\"}}",
                "{\"interval\":{\"value\":6.5,\"unit\":\"MONTH\"}}",
                "{\"interval\":{\"value\":0,\"unit\":\"DAY\"}}",
                "{\"interval\":{\"value\":3651,\"unit\":\"DAY\"}}",
                "{\"interval\":{\"value\":121,\"unit\":\"MONTH\"}}",
                "{\"interval\":{\"value\":11,\"unit\":\"YEAR\"}}"
            })
    void rejectsAMissingOrInvalidInterval(String json) throws Exception {
        setCategory("owner", "PUMP", json)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(startsWith("interval")));
        setAsset("owner", assetId, json)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(startsWith("interval")));
        assertEquals(0, categoryChanges() + assetChanges());
    }

    @ParameterizedTest
    @CsvSource({"1,DAY", "3650,DAY", "1,MONTH", "120,MONTH", "1,YEAR", "10,YEAR"})
    void acceptsEachUnitsLimits(int value, String unit) throws Exception {
        setCategory("owner", "PUMP", every(value, unit))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serviceInterval.value").value(value))
                .andExpect(jsonPath("$.serviceInterval.unit").value(unit));
        setAsset("owner", assetId, every(value, unit))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.override.value").value(value))
                .andExpect(jsonPath("$.override.unit").value(unit));
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/assets/" + assetId + "/service-interval"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/estates/" + estateId + "/asset-categories/PUMP/service-interval")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(every(6, "MONTH")))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/estates/" + estateId + "/assets/" + assetId + "/service-interval")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(every(6, "MONTH")))
                .andExpect(status().isUnauthorized());
    }
}
