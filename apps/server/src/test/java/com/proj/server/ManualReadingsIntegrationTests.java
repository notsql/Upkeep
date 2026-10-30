package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ManualReadingsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    DeviceTestData data;
    UUID estate, asset, location;
    String path;
    static final String TIME = "2026-10-01T08:00:00Z";

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        path = "/estates/" + estate + "/readings";
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Owner Technician"));
        when(workOS.findDisplayName("technician")).thenReturn(Optional.of("Crew Technician"));
    }

    String body(UUID submission, String value, String time) {
        return """
                {"assetId":"%s","metric":"TEMPERATURE","value":%s,"unit":"°C","measuredAt":"%s","submissionId":"%s"}
                """.formatted(asset, value, time, submission);
    }

    ResultActions save(String user, String body) throws Exception {
        return mvc.perform(post(path + "/manual")
                .with(jwt().jwt(j -> j.subject(user)))
                .contentType("application/json")
                .content(body));
    }

    ResultActions list(String query) throws Exception {
        return mvc.perform(get(path + query).with(jwt().jwt(j -> j.subject("owner"))));
    }

    void member(String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\",\"userId\",role) values (?, 'technician', ?)", estate, role);
    }

    void sensor(String time) {
        var device = data.device(estate, location, asset, null);
        db.execute(
                "insert into \"DeviceReading\" (id,\"estateId\",\"assetId\",\"deviceId\",metric,value,\"measuredAt\",\"receivedAt\") values (?,?,?,?,'TEMPERATURE',20,?::timestamptz,now())",
                UUID.randomUUID(),
                estate,
                asset,
                device,
                time);
    }

    @ParameterizedTest
    @ValueSource(strings = {"999999999999.123456", "999999999999.999999", "-999999999999.123456"})
    void preservesExactDecimalTextThroughStorageAndBothReadingViews(String value) throws Exception {
        save("owner", body(UUID.randomUUID(), "\"" + value + "\"", TIME))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.valueText").value(value));
        assertThat(db.fetchValue("select value from \"ManualReading\" where \"estateId\"=?", estate))
                .isEqualTo(new java.math.BigDecimal(value));
        list("").andExpect(jsonPath("$.items[0].valueText").value(value));
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].valueText").value(value));
    }

    @Test
    void numericClientsRetainCompatibilityAndReceiveExactDisplayText() throws Exception {
        save("owner", body(UUID.randomUUID(), "999999999999.123456", TIME))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.value").isNumber())
                .andExpect(jsonPath("$.valueText").value("999999999999.123456"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.0000001", "1e-7", "NaN", "1e999999999", "1e-999999999"})
    void rejectsInvalidOrOverPreciseDecimalStrings(String value) throws Exception {
        save("owner", body(UUID.randomUUID(), "\"" + value + "\"", TIME)).andExpect(status().isBadRequest());
    }

    @Test
    void ownerRecordsAgainstAnAssetWithNoDeviceAndServerAttributesIt() throws Exception {
        save("owner", body(UUID.randomUUID(), "21.1234567", TIME))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.recordedByUserId").value("owner"))
                .andExpect(jsonPath("$.recordedByName").value("Owner Technician"))
                .andExpect(jsonPath("$.value").value(21.123457))
                .andExpect(jsonPath("$.measuredAt").value(TIME))
                .andExpect(jsonPath("$.recordedAt").isString())
                .andExpect(jsonPath("$.deviceId").doesNotExist());
        assertThat(db.fetchCount(org.jooq.impl.DSL.table("\"Device\""))).isZero();
        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].recordedByName").value("Owner Technician"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void managerAndCrewCanRecordWithoutAssetRegisterAccess(String role) throws Exception {
        member(role);
        save("technician", body(UUID.randomUUID(), "21", TIME))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value("technician"));
        mvc.perform(get("/access/context").with(jwt().jwt(j -> j.subject("technician"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canRecordReadings").value(true));
        mvc.perform(get("/estates/" + estate + "/assets").with(jwt().jwt(j -> j.subject("technician"))))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(strings = {"RESIDENT", "COUNCIL", "MEMBER"})
    void otherRolesCannotRecord(String role) throws Exception {
        member(role);
        save("technician", body(UUID.randomUUID(), "21", TIME)).andExpect(status().isForbidden());
    }

    @Test
    void requiresAuthenticationAndHidesForeignEstates() throws Exception {
        mvc.perform(post(path + "/manual").contentType("application/json").content(body(UUID.randomUUID(), "1", TIME)))
                .andExpect(status().isUnauthorized());
        save("stranger", body(UUID.randomUUID(), "1", TIME)).andExpect(status().isNotFound());
    }

    @Test
    void rejectsAnAssetFromAnotherEstate() throws Exception {
        var foreign = data.estateWithAsset("owner");
        var json = body(UUID.randomUUID(), "21", TIME).replace(asset.toString(), foreign[2].toString());
        save("owner", json).andExpect(status().isNotFound());
    }

    @Test
    void retiredAssetAndInactiveEstateCannotReceiveNewEntriesButHistoryRemainsReadable() throws Exception {
        save("owner", body(UUID.randomUUID(), "21", TIME)).andExpect(status().isCreated());
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", asset);
        save("owner", body(UUID.randomUUID(), "21", TIME)).andExpect(status().isConflict());
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        save("owner", body(UUID.randomUUID(), "21", TIME)).andExpect(status().isConflict());
        list("").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/access/context").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canRecordReadings").value(false));
    }

    @Test
    void inactiveLocationDoesNotRetireAnAsset() throws Exception {
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", location);
        save("owner", body(UUID.randomUUID(), "21", TIME)).andExpect(status().isCreated());
    }

    @Test
    void normalizesOffsetsAndPrecisionAndAllowsBackdating() throws Exception {
        save("owner", body(UUID.randomUUID(), "21", "2020-01-01T08:00:00.123456789+08:00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.measuredAt").value("2020-01-01T00:00:00.123456Z"));
    }

    @Test
    void storesExtremeValuesWithFlagsRatherThanRejectingThem() throws Exception {
        save("owner", body(UUID.randomUUID(), "151", TIME)).andExpect(status().isCreated());
        list("?flag=OUT_OF_RANGE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].flags[0].type").value("OUT_OF_RANGE"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"\"not-a-number\"", "true", "null", "1000000000000", "999999999999.9999999"})
    void invalidValuesAreRejected(String value) throws Exception {
        save("owner", body(UUID.randomUUID(), value, TIME)).andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"yesterday", "2026-10-01T08:00:00", "2099-01-01T00:00:00Z"})
    void invalidOrTooFarFutureTimesAreRejected(String time) throws Exception {
        save("owner", body(UUID.randomUUID(), "21", time)).andExpect(status().isBadRequest());
    }

    @Test
    void unitMetricMissingFieldsAndSpoofedAttributionAreRejected() throws Exception {
        var json = body(UUID.randomUUID(), "21", TIME);
        for (var invalid : new String[] {
            json.replace("°C", "C"),
            json.replace("TEMPERATURE", "CUSTOM"),
            json.replace("\"unit\":\"°C\",", ""),
            json.replace("{", "{\"recordedByUserId\":\"someone-else\",")
        }) {
            save("owner", invalid).andExpect(status().isBadRequest());
        }
    }

    @Test
    void identicalRetriesReturnTheOriginalAndChangedPayloadConflicts() throws Exception {
        var id = UUID.randomUUID();
        var response = save("owner", body(id, "21.0000001", TIME))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        save("owner", body(id, "21", "2026-10-01T16:00:00+08:00"))
                .andExpect(status().isOk())
                .andExpect(result ->
                        assertThat(result.getResponse().getContentAsString()).isEqualTo(response));
        save("owner", body(id, "22", TIME)).andExpect(status().isConflict());
        list("").andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void aRetryOfAnExistingEntryStillWorksAfterRetirement() throws Exception {
        var json = body(UUID.randomUUID(), "21", TIME);
        save("owner", json).andExpect(status().isCreated());
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", asset);
        save("owner", json).andExpect(status().isOk());
    }

    @Test
    void aMissingDisplayNameDoesNotPreventRecording() throws Exception {
        when(workOS.findDisplayName("owner")).thenReturn(Optional.empty());
        save("owner", body(UUID.randomUUID(), "21", TIME))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value("owner"));
    }

    @Test
    void combinesSourcesBeforeOrderingFilteringCountingAndPaging() throws Exception {
        sensor(TIME);
        save("owner", body(UUID.randomUUID(), "151", "2026-10-01T08:01:00Z")).andExpect(status().isCreated());
        save("owner", body(UUID.randomUUID(), "22", "2026-10-01T07:59:00Z")).andExpect(status().isCreated());
        list("?size=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].source").value("MANUAL"));
        list("?size=1&page=1").andExpect(jsonPath("$.items[0].source").value("SENSOR"));
        list("?assetId=" + asset + "&metric=TEMPERATURE&from=2026-10-01T08:00:00Z&to=2026-10-01T08:01:00Z")
                .andExpect(jsonPath("$.totalItems").value(1));
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.items[0].source").value("MANUAL"));
    }

    @Test
    void marksSensorSourceAndDoesNotInventRecorderAttribution() throws Exception {
        sensor(TIME);
        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].source").value("SENSOR"))
                .andExpect(jsonPath("$.items[0].recordedByUserId").doesNotExist());
    }

    @Test
    void duplicatesAcrossSourcesAreFlaggedOnBothRowsButManualEntriesNeverFillSensorGaps() throws Exception {
        sensor(TIME);
        sensor("2026-10-01T08:05:00Z");
        save("owner", body(UUID.randomUUID(), "21", "2026-10-01T08:04:00Z")).andExpect(status().isCreated());
        save("owner", body(UUID.randomUUID(), "21", "2026-10-01T08:05:00Z")).andExpect(status().isCreated());
        list("?flag=GAP")
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].source").value("SENSOR"))
                .andExpect(jsonPath("$.items[0].flags[0].gapSeconds").value(300));
        list("?flag=DUPLICATE_TIMESTAMP").andExpect(jsonPath("$.totalItems").value(2));
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void simultaneousIdenticalSubmissionsCreateOneReading() throws Exception {
        var json = body(UUID.randomUUID(), "21", TIME);
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var tasks = java.util.stream.IntStream.range(0, 2)
                    .mapToObj(index -> executor.submit(() -> {
                        barrier.await(5, java.util.concurrent.TimeUnit.SECONDS);
                        return save("owner", json).andReturn().getResponse().getStatus();
                    }))
                    .toList();
            var statuses = new java.util.ArrayList<Integer>();
            for (var task : tasks) statuses.add(task.get(10, java.util.concurrent.TimeUnit.SECONDS));
            assertThat(statuses).containsExactlyInAnyOrder(201, 200);
            list("").andExpect(jsonPath("$.totalItems").value(1));
        } finally {
            db.execute("delete from \"ManualReading\" where \"estateId\"=?", estate);
            db.execute("delete from \"Asset\" where \"estateId\"=?", estate);
            db.execute("delete from \"Location\" where \"estateId\"=?", estate);
            db.execute("delete from \"Estate\" where id=?", estate);
        }
    }

    @Test
    void catalogueContainsFixedUnitsAndRangesAndIsScopedToReadingAccess() throws Exception {
        member("CREW");
        mvc.perform(get(path + "/metrics").with(jwt().jwt(j -> j.subject("technician"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(8))
                .andExpect(jsonPath("$[0].metric").value("TEMPERATURE"))
                .andExpect(jsonPath("$[0].unit").value("°C"))
                .andExpect(jsonPath("$[0].validMin").value(-40))
                .andExpect(jsonPath("$[0].validMax").value(150));
        mvc.perform(get(path + "/metrics").with(jwt().jwt(j -> j.subject("stranger"))))
                .andExpect(status().isNotFound());
    }
}
