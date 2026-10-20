package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** ID-68's HTTP contract, including persisted policies and maintenance cutoffs. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FlatlineIntegrationTests {
    static final Instant NOW = Instant.parse("2026-10-20T04:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    Clock clock;

    DeviceTestData data;
    UUID estateId, locationId, assetId, deviceId;
    String base;

    @BeforeEach
    void setup() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = data.device(estateId, locationId, assetId, null);
        base = "/estates/" + estateId;
    }

    MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, String user, boolean admin) {
        return request.with(jwt().jwt(token -> token.subject(user))
                .authorities(new SimpleGrantedAuthority(admin ? "ROLE_admin" : "ROLE_user")));
    }

    ResultActions owner(MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(as(request, "owner", false));
    }

    MockHttpServletRequestBuilder policyBody(String body) {
        return put(base + "/flatline-policies/TEMPERATURE")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    ResultActions policy(int minutes, String tolerance) throws Exception {
        return owner(policyBody("{\"durationMinutes\":%d,\"tolerance\":%s}".formatted(minutes, tolerance)));
    }

    ResultActions pause(int minutes) throws Exception {
        return owner(post(base + "/devices/" + deviceId + "/flatline-pauses/TEMPERATURE")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"durationMinutes\":%d}".formatted(minutes)));
    }

    ResultActions review(String query) throws Exception {
        return owner(get(base + "/flatlined-sensors" + query));
    }

    void member(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    void reading(UUID device, String metric, String value, Instant at) {
        db.execute(
                "insert into \"DeviceReading\" (id, \"deviceId\", \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz)",
                UUID.randomUUID(),
                device,
                estateId,
                assetId,
                metric,
                new BigDecimal(value),
                at.atOffset(ZoneOffset.UTC),
                NOW.atOffset(ZoneOffset.UTC));
    }

    void flatline() {
        reading(deviceId, "TEMPERATURE", "21.500000", NOW.minusSeconds(120));
        reading(deviceId, "TEMPERATURE", "21.5", NOW.minusSeconds(60));
        reading(deviceId, "TEMPERATURE", "21.500", NOW);
    }

    @Test
    void ownerSeesEveryMetricWithoutInventingADefaultDuration() throws Exception {
        owner(get(base + "/flatline-policies"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.canManage").value(true))
                .andExpect(jsonPath("$.estateActive").value(true))
                .andExpect(jsonPath("$.policies.length()").value(8))
                .andExpect(jsonPath("$.policies[0].metric").value("TEMPERATURE"))
                .andExpect(jsonPath("$.policies[0].unit").value("°C"))
                .andExpect(jsonPath("$.policies[0].durationMinutes").value((Object) null))
                .andExpect(jsonPath("$.policies[0].tolerance").value(0));
    }

    @Test
    void reviewIncludesDistinctAssetAndDeviceLocationPathsForAuthorizedReaders() throws Exception {
        var levelId = UUID.randomUUID();
        var roomId = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"sortOrder\", \"updatedAt\") values (?, ?, 'LEVEL', ?, 'BLOCK', 'L2', 2, now())",
                levelId,
                estateId,
                locationId);
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, \"parentId\", \"parentType\", name, \"updatedAt\") values (?, ?, 'COMMON_AREA', ?, 'LEVEL', 'Pump room', now())",
                roomId,
                estateId,
                levelId);
        db.execute("update \"Asset\" set \"locationId\"=? where id=?", levelId, assetId);
        db.execute("update \"Device\" set \"locationId\"=? where id=?", roomId, deviceId);
        var otherEstate = data.estateWithAsset("other-owner");
        db.execute("update \"Location\" set name='Private block' where id=?", otherEstate[1]);

        for (var role : new String[] {"COUNCIL", "MEMBER"}) {
            member(role, role);
            mvc.perform(as(get(base + "/flatlined-sensors?view=ALL"), role, "MEMBER".equals(role)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.sensors[0].assetLocationPath").value("Block A › L2"))
                    .andExpect(jsonPath("$.sensors[0].deviceLocationPath").value("Block A › L2 › Pump room"));
        }
        db.execute("update \"Location\" set name='Plant room', \"deactivatedAt\"=now() where id=?", roomId);
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].deviceLocationPath").value("Block A › L2 › Plant room"));
        db.execute("update \"Device\" set \"locationId\"=? where id=?", levelId, deviceId);
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].assetLocationPath").value("Block A › L2"))
                .andExpect(jsonPath("$.sensors[0].deviceLocationPath").value("Block A › L2"));
    }

    @Test
    void deviceKeyIngestionFlagsAConstantRunAndAChangedReadingClearsIt() throws Exception {
        var keyResponse = owner(post(base + "/assets/" + assetId + "/devices/" + deviceId + "/credential"))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String key = com.jayway.jsonpath.JsonPath.read(keyResponse, "$.apiKey");
        policy(2, "0").andExpect(status().isOk());
        for (long seconds : new long[] {120, 60, 0}) {
            mvc.perform(post("/device-api/readings")
                            .header("Authorization", "Bearer " + key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                    {"metric":"TEMPERATURE","unit":"°C","value":21.5,"measuredAt":"%s"}
                    """.formatted(NOW.minusSeconds(seconds))))
                    .andExpect(status().isCreated());
        }
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("FLATLINED"));
        mvc.perform(post("/device-api/readings")
                        .header("Authorization", "Bearer " + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                {"metric":"TEMPERATURE","unit":"°C","value":22,"measuredAt":"%s"}
                """.formatted(NOW.plusSeconds(60))))
                .andExpect(status().isCreated());
        when(clock.instant()).thenReturn(NOW.plusSeconds(60));
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void excludesReadingsAttributedToAnotherAssetEvenWithinTheSameEstate() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        var previousAsset = data.asset(estateId, locationId);
        db.execute("update \"DeviceReading\" set \"assetId\"=? where \"deviceId\"=?", previousAsset, deviceId);
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSensorReadings").value(false))
                .andExpect(jsonPath("$.sensors[0].state").value("NO_DATA"));
    }

    @Test
    void openApiRepresentsOptionalEvidenceAndPauseAsNullableObjects() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.schemas.SensorMonitoringResponse.properties.flatline.oneOf[0].$ref")
                        .value("#/components/schemas/FlatlineEvidenceResponse"))
                .andExpect(jsonPath("$.components.schemas.SensorMonitoringResponse.properties.flatline.oneOf[1].type")
                        .value("null"))
                .andExpect(jsonPath("$.components.schemas.SensorMonitoringResponse.properties.pause.oneOf[1].type")
                        .value("null"))
                .andExpect(jsonPath("$.components.schemas.SensorMonitoringResponse.properties.assetLocationPath.type")
                        .value("string"))
                .andExpect(jsonPath("$.components.schemas.SensorMonitoringResponse.properties.deviceLocationPath.type")
                        .value("string"));
    }

    @ParameterizedTest
    @CsvSource({
        "COUNCIL,false,true,false",
        "COUNCIL,true,true,true",
        "MEMBER,true,true,true",
        "MEMBER,false,false,false",
        "RESIDENT,true,false,false"
    })
    void membershipAndAdminAuthorityTogetherDetermineSensorPermissions(
            String role, boolean admin, boolean read, boolean write) throws Exception {
        member("assigned", role);
        mvc.perform(as(get(base + "/flatline-policies"), "assigned", admin)).andExpect(status().is(read ? 200 : 403));
        if (read) {
            mvc.perform(as(get(base + "/flatlined-sensors"), "assigned", admin))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.canManage").value(write));
        }
        mvc.perform(as(policyBody("{\"durationMinutes\":2,\"tolerance\":0}"), "assigned", admin))
                .andExpect(status().is(write ? 200 : 403));
        policy(2, "0").andExpect(status().isOk());
        mvc.perform(as(
                        post(base + "/devices/" + deviceId + "/flatline-pauses/TEMPERATURE")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"durationMinutes\":1}"),
                        "assigned",
                        admin))
                .andExpect(status().is(write ? 201 : 403));
    }

    @Test
    void residentMembershipOverridesConflictingOwnershipAndAdminAuthority() throws Exception {
        member("owner", "RESIDENT");
        mvc.perform(as(get(base + "/flatline-policies"), "owner", true)).andExpect(status().isForbidden());
        mvc.perform(as(policyBody("{\"durationMinutes\":2,\"tolerance\":0}"), "owner", true))
                .andExpect(status().isForbidden());
    }

    @Test
    void membershipChangesTakeEffectOnTheNextRequest() throws Exception {
        member("manager", "MEMBER");
        mvc.perform(as(get(base + "/flatline-policies"), "manager", true)).andExpect(status().isOk());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='manager'", estateId);
        mvc.perform(as(get(base + "/flatline-policies"), "manager", true)).andExpect(status().isNotFound());
    }

    @Test
    void signInAndEstateAssignmentAreRequiredEvenForPlatformAdmins() throws Exception {
        mvc.perform(get(base + "/flatline-policies")).andExpect(status().isUnauthorized());
        mvc.perform(as(get(base + "/flatline-policies"), "unassigned", true)).andExpect(status().isNotFound());
        owner(get("/estates/" + UUID.randomUUID() + "/flatline-policies")).andExpect(status().isNotFound());
        mvc.perform(as(get(base + "/flatlined-sensors/internal"), "owner", true))
                .andExpect(status().isForbidden());
        owner(delete(base + "/flatline-policies/TEMPERATURE")).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"durationMinutes\":0,\"tolerance\":0}",
                "{\"durationMinutes\":43201,\"tolerance\":0}",
                "{\"durationMinutes\":1.5,\"tolerance\":0}",
                "{\"durationMinutes\":1,\"tolerance\":-0.1}",
                "{\"durationMinutes\":1,\"tolerance\":0.0000001}",
                "{\"durationMinutes\":1,\"tolerance\":1000000000000}",
                "{\"durationMinutes\":1}",
                "{\"durationMinutes\":2147483648,\"tolerance\":0}"
            })
    void rejectsInvalidPolicyWithoutPersistingIt(String body) throws Exception {
        owner(policyBody(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(((Number) db.fetchValue("select count(*) from \"FlatlinePolicy\" where \"estateId\"=?", estateId))
                        .longValue())
                .isZero();
    }

    @Test
    void savesBoundaryValuesAndReevaluatesHistoryWhenPolicyChanges() throws Exception {
        policy(43200, "999999999999.999999").andExpect(status().isOk());
        policy(2, "0")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.durationMinutes").value(2));
        flatline();
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("FLATLINED"));
        policy(3, "0").andExpect(status().isOk());
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        assertThat(((Number) db.fetchValue("select count(*) from \"FlatlinePolicy\" where \"estateId\"=?", estateId))
                        .longValue())
                .isEqualTo(1);
    }

    @Test
    void flagsStoredSensorReadingsWithoutChangingAssetConditionAndFreezesEvidenceDuringSilence() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        when(clock.instant()).thenReturn(NOW.plusSeconds(3600));
        review("")
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.checkedAt").value("2026-10-20T05:00:00Z"))
                .andExpect(jsonPath("$.hasSensorReadings").value(true))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.sensors[0].deviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.sensors[0].flatline.observedDurationSeconds")
                        .value(120))
                .andExpect(jsonPath("$.sensors[0].flatline.latestValue").value(21.5))
                .andExpect(jsonPath("$.sensors[0].lastReadingAt").value("2026-10-20T04:00:00Z"));
        assertThat(((Number) db.fetchValue("select count(*) from \"AssetAssessment\" where \"assetId\"=?", assetId))
                        .longValue())
                .isZero();
    }

    @Test
    void inventoryDistinguishesUnconfiguredNoDataFutureOnlyAndMonitoring() throws Exception {
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("NOT_CONFIGURED"));
        policy(1, "0").andExpect(status().isOk());
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("NO_DATA"));
        reading(deviceId, "TEMPERATURE", "21", NOW.plusSeconds(60));
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("WAITING_FOR_READINGS"))
                .andExpect(jsonPath("$.sensors[0].lastReadingAt").value((Object) null));
        reading(deviceId, "TEMPERATURE", "21", NOW);
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("MONITORING"));
    }

    @Test
    void appliesMetricPolicyToEachDeviceIndependentlyAndFiltersBeforePaging() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        var second = data.device(estateId, locationId, assetId, null);
        reading(second, "TEMPERATURE", "25", NOW);
        review("?view=ALL&size=1&page=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.sensors.length()").value(1));
        review("?size=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.sensors[0].deviceId").value(deviceId.toString()));
        review("?page=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSensorReadings").value(true))
                .andExpect(jsonPath("$.sensors").isEmpty());
    }

    @Test
    void lateChangedMeasurementsReevaluateMeasurementOrderAndGapGreaterThanTwiceIntervalRestarts() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        reading(deviceId, "TEMPERATURE", "22", NOW.minusSeconds(30));
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        reading(deviceId, "TEMPERATURE", "21.5", NOW.plusSeconds(121));
        when(clock.instant()).thenReturn(NOW.plusSeconds(121));
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("MONITORING"));
    }

    @Test
    void toleranceUsesWholeRunRangeAndAcceptsExactGapBoundary() throws Exception {
        policy(4, "0.01").andExpect(status().isOk());
        reading(deviceId, "TEMPERATURE", "21", NOW.minusSeconds(240));
        reading(deviceId, "TEMPERATURE", "21.005", NOW.minusSeconds(120));
        reading(deviceId, "TEMPERATURE", "21.01", NOW);
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].flatline.minimumValue").value(21))
                .andExpect(jsonPath("$.sensors[0].flatline.maximumValue").value(21.01));
        reading(deviceId, "TEMPERATURE", "21.015", NOW.plusSeconds(60));
        when(clock.instant()).thenReturn(NOW.plusSeconds(60));
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"?page=-1", "?size=0", "?size=101", "?page=2147483647&size=100", "?view=UNKNOWN"})
    void rejectsInvalidReviewPagination(String query) throws Exception {
        review(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {"{}", "{\"durationMinutes\":0}", "{\"durationMinutes\":10081}", "{\"durationMinutes\":1.5}"})
    void rejectsInvalidPauseDurations(String body) throws Exception {
        policy(1, "0").andExpect(status().isOk());
        owner(post(base + "/devices/" + deviceId + "/flatline-pauses/TEMPERATURE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pausesOneDeviceMetricWithServerIdentityAndAutomaticallyStartsFreshAtExpiry() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        var other = data.device(estateId, locationId, assetId, null);
        reading(other, "TEMPERATURE", "9", NOW.minusSeconds(120));
        reading(other, "TEMPERATURE", "9", NOW);
        pause(1).andExpect(status().isCreated())
                .andExpect(jsonPath("$.pausedByUserId").value("owner"))
                .andExpect(jsonPath("$.pausedAt").value("2026-10-20T04:00:00Z"))
                .andExpect(jsonPath("$.resumesAt").value("2026-10-20T04:01:00Z"));
        pause(2).andExpect(status().isConflict());
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[?(@.deviceId=='" + deviceId + "')].state")
                        .value(org.hamcrest.Matchers.contains("PAUSED")));
        when(clock.instant()).thenReturn(NOW.plusSeconds(60));
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[?(@.deviceId=='" + deviceId + "')].state")
                        .value(org.hamcrest.Matchers.contains("WAITING_FOR_READINGS")));
        reading(deviceId, "TEMPERATURE", "21.5", NOW.plusSeconds(30)); // late, still before cutoff
        reading(deviceId, "TEMPERATURE", "21.5", NOW.plusSeconds(60));
        reading(deviceId, "TEMPERATURE", "21.5", NOW.plusSeconds(180));
        when(clock.instant()).thenReturn(NOW.plusSeconds(180));
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[?(@.deviceId=='" + deviceId + "')].flatline.observedDurationSeconds")
                        .value(org.hamcrest.Matchers.contains(120)));
        pause(10080).andExpect(status().isCreated());
    }

    @Test
    void blocksUnconfiguredUnsupportedForeignAndRetiredPauseTargets() throws Exception {
        pause(1).andExpect(status().isConflict());
        policy(1, "0").andExpect(status().isOk());
        owner(post(base + "/devices/" + deviceId + "/flatline-pauses/POWER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationMinutes\":1}"))
                .andExpect(status().isConflict());
        var ids = data.estateWithAsset("other-owner");
        var foreign = data.device(ids[0], ids[1], ids[2], null);
        owner(post(base + "/devices/" + foreign + "/flatline-pauses/TEMPERATURE")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationMinutes\":1}"))
                .andExpect(status().isNotFound());
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", assetId);
        pause(1).andExpect(status().isConflict());
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsCallerSuppliedPauseActorAndTimestamps() throws Exception {
        policy(1, "0").andExpect(status().isOk());
        owner(
                        post(base + "/devices/" + deviceId + "/flatline-pauses/TEMPERATURE")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"durationMinutes\":1,\"pausedByUserId\":\"someone-else\",\"resumesAt\":\"2099-01-01T00:00:00Z\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pausingOneMetricLeavesOtherMetricsOnTheSameDeviceMonitoring() throws Exception {
        db.execute("update \"Device\" set metrics='{TEMPERATURE,POWER}' where id=?", deviceId);
        policy(2, "0").andExpect(status().isOk());
        owner(put(base + "/flatline-policies/POWER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"durationMinutes\":2,\"tolerance\":0}"))
                .andExpect(status().isOk());
        flatline();
        reading(deviceId, "POWER", "4", NOW.minusSeconds(120));
        reading(deviceId, "POWER", "4", NOW);
        pause(1).andExpect(status().isCreated());
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sensors[0].state").value("PAUSED"))
                .andExpect(jsonPath("$.sensors[1].metric").value("POWER"))
                .andExpect(jsonPath("$.sensors[1].state").value("FLATLINED"));
    }

    @Test
    void inactiveEstateRetainsReadableSettingsButRejectsWritesAndHidesMonitoring() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estateId);
        owner(get(base + "/flatline-policies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateActive").value(false));
        policy(1, "0").andExpect(status().isConflict());
        pause(1).andExpect(status().isConflict());
        review("?view=ALL")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateActive").value(false))
                .andExpect(jsonPath("$.sensors").isEmpty());
    }

    @Test
    void doesNotMixAnotherEstatesReadingsAndIgnoresInactiveLocationForActiveAssets() throws Exception {
        policy(2, "0").andExpect(status().isOk());
        flatline();
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", locationId);
        review("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        var ids = data.estateWithAsset("other-owner");
        mvc.perform(as(get("/estates/" + ids[0] + "/flatlined-sensors?view=ALL"), "other-owner", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSensorReadings").value(false));
    }
}
