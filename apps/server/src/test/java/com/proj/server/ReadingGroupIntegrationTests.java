package com.proj.server;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static org.hamcrest.Matchers.contains;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
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

/**
 * getAssetReadingGroups (spec asset-readings-charts, "Grouped readings"; filters from spec
 * asset-readings-charts-refresh, phase 3).
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReadingGroupIntegrationTests {
    static final OffsetDateTime T0 = OffsetDateTime.parse("2026-11-07T12:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estate, location, asset, device;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        device = data.device(estate, location, asset, null);
    }

    static OffsetDateTime t(int second) {
        return T0.plusSeconds(second);
    }

    static String iso(int second) {
        return t(second).toInstant().toString();
    }

    UUID reading(UUID onDevice, String metric, String value, OffsetDateTime at) {
        var id = UUID.randomUUID();
        db.insertInto(DEVICEREADING)
                .set(DEVICEREADING.ID, id)
                .set(DEVICEREADING.ESTATEID, estate)
                .set(DEVICEREADING.ASSETID, asset)
                .set(DEVICEREADING.DEVICEID, onDevice)
                .set(DEVICEREADING.METRIC, metric)
                .set(DEVICEREADING.VALUE, new BigDecimal(value))
                .set(DEVICEREADING.MEASUREDAT, at)
                .set(DEVICEREADING.RECEIVEDAT, currentOffsetDateTime())
                .execute();
        return id;
    }

    void manual(String user, String name, String metric, String value, OffsetDateTime at) {
        db.insertInto(MANUALREADING)
                .set(MANUALREADING.ID, UUID.randomUUID())
                .set(MANUALREADING.ESTATEID, estate)
                .set(MANUALREADING.ASSETID, asset)
                .set(MANUALREADING.METRIC, metric)
                .set(MANUALREADING.VALUE, new BigDecimal(value))
                .set(MANUALREADING.MEASUREDAT, at)
                .set(MANUALREADING.RECORDEDAT, currentOffsetDateTime())
                .set(MANUALREADING.RECORDEDBYUSERID, user)
                .set(MANUALREADING.RECORDEDBYNAME, name)
                .set(MANUALREADING.SUBMISSIONID, UUID.randomUUID())
                .execute();
    }

    void score(OffsetDateTime at, double score) {
        db.insertInto(ANOMALYSCORE)
                .set(ANOMALYSCORE.ID, UUID.randomUUID())
                .set(ANOMALYSCORE.ESTATEID, estate)
                .set(ANOMALYSCORE.ASSETID, asset)
                .set(ANOMALYSCORE.MEASUREDAT, at)
                .set(ANOMALYSCORE.SCORE, score)
                .set(ANOMALYSCORE.SCOREDAT, currentOffsetDateTime())
                .execute();
    }

    void member(String user, String role) {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, user)
                .set(ESTATEUSER.ROLE, role)
                .execute();
    }

    ResultActions grouped(String user, String query) throws Exception {
        return mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings/grouped" + query)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions grouped(String query) throws Exception {
        return grouped("owner", query);
    }

    @Test
    void returnsTwentyTimestampsByDefaultAndHonoursAnExplicitLimit() throws Exception {
        for (int i = 0; i < 25; i++) reading(device, "TEMPERATURE", "20", t(i));
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(20))
                .andExpect(jsonPath("$.groups[0].measuredAt").value(iso(24)))
                .andExpect(jsonPath("$.groups[19].measuredAt").value(iso(5)))
                .andExpect(jsonPath("$.nextBefore").value(iso(5)));
        grouped("?limit=5")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(5))
                .andExpect(jsonPath("$.nextBefore").value(iso(20)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"?limit=0", "?limit=101", "?limit=abc", "?before=bad"})
    void invalidQueriesAreBadRequests(String query) throws Exception {
        grouped(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void pagesNewestFirstWithAnExclusiveCursorAndNoRepeatsOrGaps() throws Exception {
        for (int i = 0; i < 6; i++) reading(device, "TEMPERATURE", "20", t(i));
        grouped("?limit=3")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(5), iso(4), iso(3))))
                .andExpect(jsonPath("$.nextBefore").value(iso(3)));
        grouped("?limit=3&before=" + iso(3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(2), iso(1), iso(0))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
        grouped("?before=" + iso(0))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(0))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
    }

    @Test
    void groupsByInstantAndSourceKeepingDevicesAndRecordersApart() throws Exception {
        var second = data.device(estate, location, asset, null);
        reading(device, "TEMPERATURE", "20", T0);
        reading(device, "PRESSURE", "2", T0);
        reading(device, "POWER", "1", T0);
        reading(second, "TEMPERATURE", "21", T0);
        manual("owner", "Olive Owner", "TEMPERATURE", "22", T0);
        manual("owner", "Olive Owner", "PRESSURE", "3", T0);
        manual("crew", "Cal Crew", "TEMPERATURE", "23", T0);
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(4))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(0), iso(0), iso(0), iso(0))))
                .andExpect(jsonPath("$.groups[?(@.deviceId == '" + device + "')].metrics.length()")
                        .value(3))
                .andExpect(jsonPath("$.groups[?(@.deviceId == '" + device + "')].source")
                        .value("SENSOR"))
                .andExpect(jsonPath("$.groups[?(@.deviceId == '" + device + "')].deviceIdentifier")
                        .value("DEV-" + device))
                .andExpect(jsonPath("$.groups[?(@.deviceId == '" + second + "')].metrics.length()")
                        .value(1))
                .andExpect(jsonPath("$.groups[?(@.recordedByName == 'Olive Owner')].metrics.length()")
                        .value(2))
                .andExpect(jsonPath("$.groups[?(@.recordedByName == 'Olive Owner')].source")
                        .value("MANUAL"))
                .andExpect(jsonPath("$.groups[?(@.recordedByName == 'Olive Owner')].deviceId")
                        .isEmpty())
                .andExpect(jsonPath("$.groups[?(@.recordedByName == 'Cal Crew')].metrics.length()")
                        .value(1));
    }

    @Test
    void aPartialTimestampReturnsOnlyTheMetricsItHas() throws Exception {
        reading(device, "TEMPERATURE", "20", T0);
        reading(device, "PRESSURE", "2", T0);
        reading(device, "FLOW_RATE", "30", T0);
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(1))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE", "PRESSURE", "FLOW_RATE")));
    }

    @Test
    void neverSplitsGroupsSharingTheOldestTimestamp() throws Exception {
        var second = data.device(estate, location, asset, null);
        reading(device, "TEMPERATURE", "20", t(0));
        reading(device, "TEMPERATURE", "20", t(1));
        reading(second, "TEMPERATURE", "20", t(1));
        manual("owner", "Olive Owner", "TEMPERATURE", "20", t(1));
        reading(device, "TEMPERATURE", "20", t(2));
        grouped("?limit=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(4))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(2), iso(1), iso(1), iso(1))))
                .andExpect(jsonPath("$.nextBefore").value(iso(1)));
        grouped("?limit=2&before=" + iso(1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(0))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
    }

    @Test
    void manySourcesAtOneInstantDoNotHideOlderTimestamps() throws Exception {
        var second = data.device(estate, location, asset, null);
        reading(device, "TEMPERATURE", "20", t(0));
        reading(device, "TEMPERATURE", "20", t(1));
        reading(second, "TEMPERATURE", "20", t(1));
        grouped("?limit=1&before=" + iso(2))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1), iso(1))))
                .andExpect(jsonPath("$.nextBefore").value(iso(1)));
    }

    /** Within one instant, device groups come before manual ones. */
    @Test
    void carriesTheSameFlagsAsTheReadingsEndpoint() throws Exception {
        reading(device, "TEMPERATURE", "20", T0.minusMinutes(5));
        reading(device, "TEMPERATURE", "151", T0);
        manual("owner", "Olive Owner", "TEMPERATURE", "20", T0);
        reading(device, "PRESSURE", "2", T0);
        score(T0, 0.8);
        grouped("?limit=1")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].source").value("SENSOR"))
                .andExpect(jsonPath(
                        "$.groups[0].metrics[0].flags[*].type",
                        contains("GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE", "ANOMALY")))
                .andExpect(
                        jsonPath("$.groups[0].metrics[0].flags[0].gapSeconds").value(300))
                .andExpect(jsonPath("$.groups[0].metrics[0].flags[2].validMin").value(-40.0))
                .andExpect(jsonPath("$.groups[0].metrics[0].flags[2].validMax").value(150.0))
                .andExpect(
                        jsonPath("$.groups[0].metrics[0].flags[3].anomalyScore").value(0.8))
                .andExpect(jsonPath("$.groups[0].metrics[1].metric").value("PRESSURE"))
                .andExpect(jsonPath("$.groups[0].metrics[1].flags[*].type", contains("ANOMALY")))
                .andExpect(jsonPath("$.groups[1].source").value("MANUAL"))
                .andExpect(jsonPath("$.groups[1].metrics[0].flags[*].type", contains("DUPLICATE_TIMESTAMP")));
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings?metric=TEMPERATURE&size=1&from="
                                + T0.toInstant() + "&flag=OUT_OF_RANGE")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(jsonPath(
                        "$.items[0].flags[*].type", contains("GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE", "ANOMALY")));
    }

    @Test
    void carriesTheStoredScoreOnScoredDeviceGroupsOnly() throws Exception {
        reading(device, "TEMPERATURE", "20", t(1));
        manual("owner", "Olive Owner", "PRESSURE", "20", t(1));
        reading(device, "TEMPERATURE", "20", t(0));
        score(t(1), 0.3);
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].source").value("SENSOR"))
                .andExpect(jsonPath("$.groups[0].anomalyScore").value(0.3))
                .andExpect(jsonPath("$.groups[0].metrics[0].flags.length()").value(0))
                .andExpect(jsonPath("$.groups[1].source").value("MANUAL"))
                .andExpect(jsonPath("$.groups[1].anomalyScore").doesNotExist())
                .andExpect(jsonPath("$.groups[2].anomalyScore").doesNotExist());
    }

    @Test
    void listsMetricsInCatalogueOrderWithExactManualDecimals() throws Exception {
        reading(device, "POWER", "0.33689", T0);
        reading(device, "TEMPERATURE", "20", T0);
        reading(device, "PRESSURE", "-0.273216", T0);
        manual("owner", "Olive Owner", "PRESSURE", "12.345600", T0);
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE", "PRESSURE", "POWER")))
                .andExpect(jsonPath("$.groups[0].metrics[*].unit", contains("°C", "bar", "kW")))
                .andExpect(jsonPath("$.groups[0].metrics[1].value").value(-0.273216))
                .andExpect(jsonPath("$.groups[0].metrics[1].readingId").isString())
                .andExpect(jsonPath("$.groups[0].metrics[1].valueText").doesNotExist())
                .andExpect(jsonPath("$.groups[1].metrics[0].value").value(12.3456))
                .andExpect(jsonPath("$.groups[1].metrics[0].valueText").value("12.3456"));
    }

    @Test
    void fromIsInclusiveAndToExclusive() throws Exception {
        for (int i = 0; i < 6; i++) reading(device, "TEMPERATURE", "20", t(i));
        grouped("?from=" + iso(1) + "&to=" + iso(4))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(3), iso(2), iso(1))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
        grouped("?from=" + iso(4)).andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(5), iso(4))));
        grouped("?to=" + iso(2)).andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1), iso(0))));
    }

    @Test
    void theUpperBoundIsTheEarlierOfBeforeAndTo() throws Exception {
        for (int i = 0; i < 6; i++) reading(device, "TEMPERATURE", "20", t(i));
        grouped("?to=" + iso(4) + "&before=" + iso(2))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1), iso(0))));
        grouped("?to=" + iso(2) + "&before=" + iso(4))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1), iso(0))));
        grouped("?from=" + iso(3) + "&before=" + iso(2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "?from=2026-11-07T12:00:02Z&to=2026-11-07T12:00:02Z",
                "?from=2026-11-07T12:00:03Z&to=2026-11-07T12:00:01Z",
                "?from=bad",
                "?to=bad",
                "?metric=BOGUS",
                "?flag=BOGUS"
            })
    void invalidFiltersAreBadRequests(String query) throws Exception {
        grouped(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void aMetricFilterRestrictsTheGroupsAndTheirMetrics() throws Exception {
        reading(device, "TEMPERATURE", "20", t(0));
        reading(device, "PRESSURE", "2", t(0));
        reading(device, "POWER", "1", t(0));
        reading(device, "POWER", "1", t(1));
        manual("owner", "Olive Owner", "PRESSURE", "3", t(2));
        grouped("?metric=TEMPERATURE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(0))))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE")));
        grouped("?metric=TEMPERATURE&metric=POWER")
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1), iso(0))))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("POWER")))
                .andExpect(jsonPath("$.groups[1].metrics[*].metric", contains("TEMPERATURE", "POWER")));
        grouped("?metric=PRESSURE").andExpect(jsonPath("$.groups[*].source", contains("MANUAL", "SENSOR")));
    }

    @Test
    void aFlagFilterMatchesAnyFlagAndReturnsTheWholeGroup() throws Exception {
        for (int i = 0; i < 4; i++) {
            reading(device, "TEMPERATURE", i == 1 ? "151" : "20", t(i));
            reading(device, "PRESSURE", "2", t(i));
        }
        score(t(2), 0.8);
        score(t(3), 0.1);
        grouped("?flag=OUT_OF_RANGE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1))))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE", "PRESSURE")))
                .andExpect(jsonPath("$.groups[0].metrics[0].flags[*].type", contains("OUT_OF_RANGE")))
                .andExpect(jsonPath("$.groups[0].metrics[1].flags.length()").value(0));
        grouped("?flag=OUT_OF_RANGE&flag=ANOMALY")
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(2), iso(1))));
    }

    @Test
    void metricAndFlagTogetherMatchOnlyThatMetricsReadings() throws Exception {
        reading(device, "TEMPERATURE", "151", t(1));
        reading(device, "PRESSURE", "2", t(1));
        grouped("?metric=PRESSURE&flag=OUT_OF_RANGE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(0));
        grouped("?metric=TEMPERATURE&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1))))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE")));
    }

    @Test
    void aFlagFilterMatchesPerSourceAtASharedInstant() throws Exception {
        reading(device, "TEMPERATURE", "151", T0);
        manual("owner", "Olive Owner", "PRESSURE", "3", T0);
        grouped("?flag=OUT_OF_RANGE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].source", contains("SENSOR")));
    }

    @Test
    void flagsAreComputedOverEveryReadingWhateverTheFilters() throws Exception {
        reading(device, "TEMPERATURE", "20", T0.minusMinutes(5));
        reading(device, "TEMPERATURE", "20", T0);
        reading(device, "PRESSURE", "2", T0);
        grouped("?metric=TEMPERATURE&from=" + iso(0))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(1))
                .andExpect(jsonPath("$.groups[0].metrics[0].flags[*].type", contains("GAP")))
                .andExpect(
                        jsonPath("$.groups[0].metrics[0].flags[0].gapSeconds").value(300));
        grouped("?flag=GAP&from=" + iso(0))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(0))))
                .andExpect(jsonPath("$.groups[0].metrics[*].metric", contains("TEMPERATURE", "PRESSURE")));
    }

    /** Anomalous only is served from the stored scores; it must agree with the flags on the groups. */
    @Test
    void anomalousOnlyKeepsDeviceGroupsWithAScoredReadingOfTheMetric() throws Exception {
        reading(device, "TEMPERATURE", "20", t(0));
        reading(device, "PRESSURE", "2", t(1));
        manual("owner", "Olive Owner", "TEMPERATURE", "20", t(1));
        reading(device, "TEMPERATURE", "20", t(2));
        reading(device, "TEMPERATURE", "20", t(3));
        score(t(0), 0.9);
        score(t(1), 0.9);
        score(t(2), 0.1);
        score(t(3), 0.9);
        grouped("?flag=ANOMALY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(3), iso(1), iso(0))))
                .andExpect(jsonPath("$.groups[*].source", contains("SENSOR", "SENSOR", "SENSOR")));
        grouped("?flag=ANOMALY&metric=TEMPERATURE")
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(3), iso(0))));
        grouped("?flag=ANOMALY&limit=1&from=" + iso(1) + "&to=" + iso(4))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(3))))
                .andExpect(jsonPath("$.nextBefore").value(iso(3)));
        grouped("?flag=ANOMALY&limit=1&from=" + iso(1) + "&before=" + iso(3))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(1))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
    }

    @Test
    void pagesFilteredResultsWithNoRepeatsOrGaps() throws Exception {
        for (int i = 0; i < 10; i++) reading(device, "TEMPERATURE", i % 2 == 0 ? "151" : "20", t(i));
        var second = data.device(estate, location, asset, null);
        reading(second, "PRESSURE", "-1", t(6));
        grouped("?flag=OUT_OF_RANGE&limit=2")
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(8), iso(6), iso(6))))
                .andExpect(jsonPath("$.nextBefore").value(iso(6)));
        grouped("?flag=OUT_OF_RANGE&limit=2&before=" + iso(6))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(4), iso(2))))
                .andExpect(jsonPath("$.nextBefore").value(iso(2)));
        grouped("?flag=OUT_OF_RANGE&limit=2&before=" + iso(2))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(0))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
        grouped("?metric=TEMPERATURE&limit=4&from=" + iso(3))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(9), iso(8), iso(7), iso(6))))
                .andExpect(jsonPath("$.nextBefore").value(iso(6)));
        grouped("?metric=TEMPERATURE&limit=4&from=" + iso(3) + "&before=" + iso(6))
                .andExpect(jsonPath("$.groups[*].measuredAt", contains(iso(5), iso(4), iso(3))))
                .andExpect(jsonPath("$.nextBefore").doesNotExist());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings/grouped"))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void managersAndCrewCanRead(String role) throws Exception {
        member("reader", role);
        grouped("reader", "").andExpect(status().isOk());
    }

    @Test
    void residentsAreForbidden() throws Exception {
        member("resident", "RESIDENT");
        grouped("resident", "").andExpect(status().isForbidden());
    }

    @Test
    void unknownAndCrossEstateAssetsAreNotFound() throws Exception {
        var foreign = data.estateWithAsset("owner");
        mvc.perform(get("/estates/" + estate + "/assets/" + foreign[2] + "/readings/grouped")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + estate + "/assets/" + UUID.randomUUID() + "/readings/grouped")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        grouped("stranger", "").andExpect(status().isNotFound());
    }

    @Test
    void aRetiredAssetIsReadable() throws Exception {
        reading(device, "TEMPERATURE", "20", T0);
        db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ASSET.ID.eq(asset))
                .execute();
        grouped("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups.length()").value(1));
    }
}
