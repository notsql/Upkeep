package com.proj.server;

import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * Asset events (spec "Asset events" and "Which events count"). Integration-level because the
 * ordering, the unit snapshot and {@code countsTowardForecast} depend on real queries.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetEventIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, levelId, assetId, grundfos, cr10, ebara, evms;
    String events;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        levelId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                levelId,
                estateId);
        grundfos = manufacturer("GRUNDFOS");
        cr10 = model(grundfos, "CR 10");
        ebara = manufacturer("EBARA");
        evms = model(ebara, "EVMS 5");
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"manufacturerId\", \"modelId\", \"updatedAt\") values (?, ?, ?, 'E-A0001', 'Booster pump', 'PUMP', '2020-01-01', ?, ?, now())",
                assetId,
                estateId,
                levelId,
                grundfos,
                cr10);
        events = "/estates/" + estateId + "/assets/" + assetId + "/events";
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
    }

    UUID manufacturer(String name) {
        var id = UUID.randomUUID();
        // Unique per test run: the catalogue is shared and other tests may hold the same names.
        db.execute("insert into \"Manufacturer\" (id, name) values (?, ?)", id, name + " " + id);
        return id;
    }

    UUID model(UUID manufacturer, String name) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"AssetModel\" (id, \"manufacturerId\", category, name) values (?, ?, 'PUMP', ?)",
                id,
                manufacturer,
                name);
        return id;
    }

    String manufacturerName(UUID id) {
        return db.fetchValue("select name from \"Manufacturer\" where id = ?", id).toString();
    }

    void replaceUnit(UUID manufacturer, UUID model) {
        db.execute(
                "update \"Asset\" set \"manufacturerId\" = ?::uuid, \"modelId\" = ?::uuid where id = ?", manufacturer, model, assetId);
    }

    static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(t -> t.subject(subject)));
    }

    MockHttpServletRequestBuilder record(String json) {
        return as("owner", post(events)).contentType(MediaType.APPLICATION_JSON).content(json);
    }

    static String body(String type, Object occurredOn, String notes) {
        return """
                {"type":"%s","occurredOn":"%s","notes":"%s"}""".formatted(type, occurredOn, notes);
    }

    @ParameterizedTest
    @ValueSource(strings = {"BREAKDOWN_REPAIR", "PREVENTIVE"})
    void eachTypeIsAMaintenanceEvent(String type) throws Exception {
        mvc.perform(record(body(type, "2026-09-01", "Done")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value(type))
                .andExpect(jsonPath("$.category").value("MAINTENANCE"));
    }

    @Test
    void recordsAnEventWithItsUnitSnapshotAndRecorder() throws Exception {
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2026-09-01", "Replaced the mechanical seal.")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.assetId").value(assetId.toString()))
                .andExpect(jsonPath("$.occurredOn").value("2026-09-01"))
                .andExpect(jsonPath("$.notes").value("Replaced the mechanical seal."))
                .andExpect(jsonPath("$.assetManufacturer").value(manufacturerName(grundfos)))
                .andExpect(jsonPath("$.assetModel").value("CR 10"))
                .andExpect(jsonPath("$.countsTowardForecast").value(true))
                .andExpect(jsonPath("$.recordedByUserId").value("owner"))
                .andExpect(jsonPath("$.recordedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
        var snapshot = db.fetchOne(
                "select \"manufacturerId\", \"modelId\" from \"AssetEvent\" where \"assetId\" = ?", assetId);
        org.junit.jupiter.api.Assertions.assertEquals(grundfos, snapshot.get(0, UUID.class));
        org.junit.jupiter.api.Assertions.assertEquals(cr10, snapshot.get(1, UUID.class));
    }

    @Test
    void savesTheEventEvenWhenWorkOSCannotNameTheRecorder() throws Exception {
        when(workOS.findDisplayName("owner")).thenReturn(Optional.empty());
        mvc.perform(record(body("PREVENTIVE", "2026-09-01", "Serviced")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value("owner"))
                .andExpect(jsonPath("$.recordedByName").value(nullValue()));
    }

    @Test
    void anAssetWithNoUnitRecordedSnapshotsNullsThatStillCount() throws Exception {
        replaceUnit(null, null);
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2026-09-01", "Fixed")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assetManufacturer").value(nullValue()))
                .andExpect(jsonPath("$.assetModel").value(nullValue()))
                .andExpect(jsonPath("$.countsTowardForecast").value(true));
    }

    @Test
    void listsEventsNewestFirstByDateThenRecordedTime() throws Exception {
        mvc.perform(record(body("PREVENTIVE", "2025-01-01", "Oldest"))).andExpect(status().isCreated());
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2026-05-01", "Newest date"))).andExpect(status().isCreated());
        mvc.perform(record(body("PREVENTIVE", "2025-06-01", "Back-dated"))).andExpect(status().isCreated());
        // Two on the same date: the later-recorded one comes first.
        insertEvent("PREVENTIVE", "2024-03-01", "Same day, recorded first", "2026-01-01T00:00:00Z");
        insertEvent("BREAKDOWN_REPAIR", "2024-03-01", "Same day, recorded second", "2026-01-02T00:00:00Z");
        mvc.perform(as("owner", get(events)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(5))
                .andExpect(jsonPath("$[0].notes").value("Newest date"))
                .andExpect(jsonPath("$[1].notes").value("Back-dated"))
                .andExpect(jsonPath("$[2].notes").value("Oldest"))
                .andExpect(jsonPath("$[3].notes").value("Same day, recorded second"))
                .andExpect(jsonPath("$[4].notes").value("Same day, recorded first"));
    }

    void insertEvent(String type, String occurredOn, String notes, String createdAt) {
        db.execute(
                "insert into \"AssetEvent\" (id, \"estateId\", \"assetId\", type, \"occurredOn\", notes, \"manufacturerId\", \"modelId\", \"recordedByUserId\", \"createdAt\") values (?, ?, ?, ?, ?::date, ?, ?, ?, 'owner', ?::timestamptz)",
                UUID.randomUUID(),
                estateId,
                assetId,
                type,
                occurredOn,
                notes,
                grundfos,
                cr10,
                createdAt);
    }

    @Test
    void replacingTheUnitStopsEarlierEventsCountingButKeepsThemListed() throws Exception {
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2025-01-01", "Old unit"))).andExpect(status().isCreated());
        replaceUnit(ebara, evms);
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2026-01-01", "New unit")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.assetManufacturer").value(manufacturerName(ebara)))
                .andExpect(jsonPath("$.assetModel").value("EVMS 5"))
                .andExpect(jsonPath("$.countsTowardForecast").value(true));
        mvc.perform(as("owner", get(events)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].notes").value("New unit"))
                .andExpect(jsonPath("$[0].countsTowardForecast").value(true))
                .andExpect(jsonPath("$[1].notes").value("Old unit"))
                .andExpect(jsonPath("$[1].assetManufacturer").value(manufacturerName(grundfos)))
                .andExpect(jsonPath("$[1].assetModel").value("CR 10"))
                .andExpect(jsonPath("$[1].countsTowardForecast").value(false));
    }

    @Test
    void changingOnlyTheModelStopsEarlierEventsCounting() throws Exception {
        mvc.perform(record(body("PREVENTIVE", "2025-01-01", "Old model"))).andExpect(status().isCreated());
        replaceUnit(grundfos, model(grundfos, "CR 15"));
        mvc.perform(as("owner", get(events)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].countsTowardForecast").value(false));
    }

    @Test
    void movingInstalledOnLaterStopsEarlierEventsCounting() throws Exception {
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2024-01-01", "Before"))).andExpect(status().isCreated());
        mvc.perform(record(body("BREAKDOWN_REPAIR", "2025-01-01", "On the day"))).andExpect(status().isCreated());
        db.execute("update \"Asset\" set \"installedOn\" = '2025-01-01' where id = ?", assetId);
        mvc.perform(as("owner", get(events)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].notes").value("On the day"))
                .andExpect(jsonPath("$[0].countsTowardForecast").value(true))
                .andExpect(jsonPath("$[1].notes").value("Before"))
                .andExpect(jsonPath("$[1].countsTowardForecast").value(false));
    }

    @Test
    void rejectsAFutureDate() throws Exception {
        // Two days ahead is in the future in every time zone.
        mvc.perform(record(body("PREVENTIVE", LocalDate.now().plusDays(2), "Fine")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertNoEvents();
    }

    @Test
    void rejectsADateBeforeInstalledOn() throws Exception {
        mvc.perform(record(body("PREVENTIVE", "2019-12-31", "Fine")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(record(body("PREVENTIVE", "2020-01-01", "On the install date"))).andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"occurredOn\":\"2026-09-01\",\"notes\":\"Fine\"}",
                "{\"type\":\"OVERHAUL\",\"occurredOn\":\"2026-09-01\",\"notes\":\"Fine\"}",
                "{\"type\":\"PREVENTIVE\",\"notes\":\"Fine\"}",
                "{\"type\":\"PREVENTIVE\",\"occurredOn\":\"not-a-date\",\"notes\":\"Fine\"}",
                "{\"type\":\"PREVENTIVE\",\"occurredOn\":\"2026-09-01\",\"notes\":\"   \"}",
                "{\"type\":\"PREVENTIVE\",\"occurredOn\":\"2026-09-01\"}"
            })
    void rejectsMissingOrInvalidDetails(String json) throws Exception {
        mvc.perform(record(json)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").isNotEmpty());
        assertNoEvents();
    }

    void assertNoEvents() {
        var count = (Number) db.fetchValue("select count(*) from \"AssetEvent\" where \"assetId\" = ?", assetId);
        org.junit.jupiter.api.Assertions.assertEquals(0, count.intValue());
    }

    @Test
    void aDeactivatedAssetKeepsItsEventsButRejectsNewOnes() throws Exception {
        mvc.perform(record(body("PREVENTIVE", "2025-01-01", "Serviced"))).andExpect(status().isCreated());
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", assetId);
        mvc.perform(as("owner", get(events)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(record(body("PREVENTIVE", "2025-02-01", "Again"))).andExpect(status().isConflict());
    }

    @Test
    void rejectsEventsInAnInactiveEstate() throws Exception {
        mvc.perform(as("owner", get(events))).andExpect(status().isOk());
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        mvc.perform(record(body("PREVENTIVE", "2025-02-01", "Serviced"))).andExpect(status().isConflict());
        assertNoEvents();
    }

    @Test
    void hidesOtherOwnersEstatesAndUnknownAssets() throws Exception {
        mvc.perform(as("owner", get(events))).andExpect(status().isOk());
        mvc.perform(as("other", get(events))).andExpect(status().isNotFound());
        mvc.perform(as("other", post(events))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PREVENTIVE", "2025-01-01", "Fine")))
                .andExpect(status().isNotFound());
        var unknownAsset = "/estates/" + estateId + "/assets/" + UUID.randomUUID() + "/events";
        mvc.perform(as("owner", get(unknownAsset))).andExpect(status().isNotFound());
        var unknownEstate = "/estates/" + UUID.randomUUID() + "/assets/" + assetId + "/events";
        mvc.perform(as("owner", get(unknownEstate))).andExpect(status().isNotFound());
        assertNoEvents();
    }

    @Test
    void requiresASignedInSubject() throws Exception {
        mvc.perform(as("owner", get(events))).andExpect(status().isOk());
        mvc.perform(get(events)).andExpect(status().isUnauthorized());
        mvc.perform(post(events)
                        .with(jwt().jwt(t -> t.claims(claims -> claims.remove("sub"))))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("PREVENTIVE", "2025-01-01", "Fine")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get(events).with(jwt().jwt(t -> t.claims(claims -> claims.remove("sub")))))
                .andExpect(status().isUnauthorized());
        assertNoEvents();
    }
}
