package com.proj.server;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.jooq.impl.DSL.generateSeries;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.select;
import static org.jooq.impl.DSL.uuid;
import static org.jooq.impl.DSL.val;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.types.DayToSecond;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

/** getAssetReadingSeries (spec asset-readings-charts, "Series"). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReadingSeriesIntegrationTests {
    static final OffsetDateTime T0 = OffsetDateTime.parse("2026-11-07T12:00:00Z");
    static final String MINUTE = "?from=2026-11-07T12:00:00Z&to=2026-11-07T12:01:00Z";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    AnomalyTestData samples;
    UUID estate, location, asset, device;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        samples = new AnomalyTestData(db);
        var ids = data.estateWithAsset("owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        device = data.device(estate, location, asset, null);
    }

    void reading(UUID onDevice, String metric, String value, OffsetDateTime at) {
        db.insertInto(DEVICEREADING)
                .set(DEVICEREADING.ID, UUID.randomUUID())
                .set(DEVICEREADING.ESTATEID, estate)
                .set(DEVICEREADING.ASSETID, asset)
                .set(DEVICEREADING.DEVICEID, onDevice)
                .set(DEVICEREADING.METRIC, metric)
                .set(DEVICEREADING.VALUE, new BigDecimal(value))
                .set(DEVICEREADING.MEASUREDAT, at)
                .set(DEVICEREADING.RECEIVEDAT, currentOffsetDateTime())
                .execute();
    }

    void score(UUID onAsset, OffsetDateTime at, double score) {
        db.insertInto(ANOMALYSCORE)
                .set(ANOMALYSCORE.ID, UUID.randomUUID())
                .set(ANOMALYSCORE.ESTATEID, estate)
                .set(ANOMALYSCORE.ASSETID, onAsset)
                .set(ANOMALYSCORE.MEASUREDAT, at)
                .set(ANOMALYSCORE.SCORE, score)
                .set(ANOMALYSCORE.SCOREDAT, currentOffsetDateTime())
                .execute();
    }

    ResultActions series(String user, String query) throws Exception {
        return mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings/series" + query)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions series(String query) throws Exception {
        return series("owner", query);
    }

    @ParameterizedTest
    @CsvSource({
        "2026-11-07T12:01:00Z, 1",
        "2026-11-07T12:15:00Z, 5",
        "2026-11-07T13:00:00Z, 15",
        "2026-11-08T12:00:00Z, 300",
        // 25 min / 300 = 5 s exactly; one more second steps up, never past 300 buckets.
        "2026-11-07T12:25:00Z, 5",
        "2026-11-07T12:25:01Z, 10"
    })
    void picksTheSmallestStepThatKeepsAtMostThreeHundredBuckets(String to, int bucket) throws Exception {
        series("?from=2026-11-07T12:00:00Z&to=" + to)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucketSeconds").value(bucket))
                .andExpect(jsonPath("$.from").value("2026-11-07T12:00:00Z"))
                .andExpect(jsonPath("$.to").value(to))
                .andExpect(jsonPath("$.anomalyThreshold").value(0.51))
                .andExpect(jsonPath("$.metrics.length()").value(0))
                .andExpect(jsonPath("$.anomalies.length()").value(0));
    }

    @Test
    void echoesTheRangeInUtc() throws Exception {
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings/series")
                        .param("from", "2026-11-07T20:00:00+08:00")
                        .param("to", "2026-11-07T20:01:00+08:00")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.from").value("2026-11-07T12:00:00Z"))
                .andExpect(jsonPath("$.to").value("2026-11-07T12:01:00Z"));
    }

    @Test
    void anHourAtOneHertzIsTwoHundredFortyBucketsOfFifteen() throws Exception {
        var series = generateSeries(0, 3599);
        db.insertInto(DEVICEREADING)
                .columns(
                        DEVICEREADING.ID,
                        DEVICEREADING.ESTATEID,
                        DEVICEREADING.ASSETID,
                        DEVICEREADING.DEVICEID,
                        DEVICEREADING.METRIC,
                        DEVICEREADING.VALUE,
                        DEVICEREADING.MEASUREDAT,
                        DEVICEREADING.RECEIVEDAT)
                .select(select(
                                uuid(),
                                val(estate),
                                val(asset),
                                val(device),
                                inline("TEMPERATURE"),
                                inline(BigDecimal.ONE),
                                val(T0).add(val(DayToSecond.valueOf(Duration.ofSeconds(1)))
                                        .mul(series.field(0, Integer.class))),
                                currentOffsetDateTime())
                        .from(series))
                .execute();
        series("?from=2026-11-07T12:00:00Z&to=2026-11-07T13:00:00Z")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucketSeconds").value(15))
                .andExpect(jsonPath("$.metrics[0].points.length()").value(240))
                .andExpect(jsonPath("$.metrics[0].points[*].count", everyItem(is(15))))
                .andExpect(jsonPath("$.metrics[0].points[0].start").value("2026-11-07T12:00:00Z"))
                .andExpect(jsonPath("$.metrics[0].points[239].start").value("2026-11-07T12:59:45Z"));
    }

    @Test
    void oneMinuteReturnsRawOneSecondSamples() throws Exception {
        for (int i = 0; i < 60; i++) reading(device, "TEMPERATURE", String.valueOf(i), T0.plusSeconds(i));
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucketSeconds").value(1))
                .andExpect(jsonPath("$.metrics[0].points.length()").value(60))
                .andExpect(jsonPath("$.metrics[0].points[7].start").value("2026-11-07T12:00:07Z"))
                .andExpect(jsonPath("$.metrics[0].points[7].min").value(7.0))
                .andExpect(jsonPath("$.metrics[0].points[7].max").value(7.0))
                .andExpect(jsonPath("$.metrics[0].points[7].avg").value(7.0))
                .andExpect(jsonPath("$.metrics[0].points[7].count").value(1));
    }

    @Test
    void bucketsAlignToTheEpochAndCountOnlyReadingsInTheHalfOpenRange() throws Exception {
        reading(device, "TEMPERATURE", "1", OffsetDateTime.parse("2026-11-07T12:00:06Z"));
        reading(device, "TEMPERATURE", "2", OffsetDateTime.parse("2026-11-07T12:00:07Z"));
        reading(device, "TEMPERATURE", "4", OffsetDateTime.parse("2026-11-07T12:00:08Z"));
        reading(device, "TEMPERATURE", "8", OffsetDateTime.parse("2026-11-07T12:15:06Z"));
        reading(device, "TEMPERATURE", "16", OffsetDateTime.parse("2026-11-07T12:15:07Z"));
        series("?from=2026-11-07T12:00:07Z&to=2026-11-07T12:15:07Z")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bucketSeconds").value(5))
                .andExpect(jsonPath("$.metrics[0].points.length()").value(2))
                .andExpect(jsonPath("$.metrics[0].points[0].start").value("2026-11-07T12:00:05Z"))
                .andExpect(jsonPath("$.metrics[0].points[0].count").value(2))
                .andExpect(jsonPath("$.metrics[0].points[0].min").value(2.0))
                .andExpect(jsonPath("$.metrics[0].points[1].start").value("2026-11-07T12:15:05Z"))
                .andExpect(jsonPath("$.metrics[0].points[1].count").value(1))
                .andExpect(jsonPath("$.metrics[0].points[1].max").value(8.0));
    }

    @Test
    void aggregatesEachBucketAndOmitsEmptyOnes() throws Exception {
        reading(device, "TEMPERATURE", "1", T0.plusNanos(100_000_000));
        reading(device, "TEMPERATURE", "2", T0.plusNanos(500_000_000));
        reading(device, "TEMPERATURE", "6", T0.plusNanos(900_000_000));
        reading(device, "TEMPERATURE", "-3.5", T0.plusSeconds(10));
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics[0].metric").value("TEMPERATURE"))
                .andExpect(jsonPath("$.metrics[0].unit").value("°C"))
                .andExpect(jsonPath("$.metrics[0].points.length()").value(2))
                .andExpect(jsonPath("$.metrics[0].points[0].start").value("2026-11-07T12:00:00Z"))
                .andExpect(jsonPath("$.metrics[0].points[0].min").value(1.0))
                .andExpect(jsonPath("$.metrics[0].points[0].max").value(6.0))
                .andExpect(jsonPath("$.metrics[0].points[0].avg").value(3.0))
                .andExpect(jsonPath("$.metrics[0].points[0].count").value(3))
                .andExpect(jsonPath("$.metrics[0].points[1].start").value("2026-11-07T12:00:10Z"))
                .andExpect(jsonPath("$.metrics[0].points[1].avg").value(-3.5));
    }

    @Test
    void returnsMetricsInCatalogueOrderAndFiltersByRepeatedMetric() throws Exception {
        reading(device, "POWER", "1", T0);
        reading(device, "TEMPERATURE", "1", T0);
        reading(device, "PRESSURE", "1", T0);
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics[*].metric", contains("TEMPERATURE", "PRESSURE", "POWER")))
                .andExpect(jsonPath("$.metrics[*].unit", contains("°C", "bar", "kW")));
        series(MINUTE + "&metric=POWER&metric=TEMPERATURE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics[*].metric", contains("TEMPERATURE", "POWER")));
        series(MINUTE + "&metric=HUMIDITY")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics.length()").value(0));
    }

    @Test
    void leavesOutManualReadingsAndOtherAssets() throws Exception {
        samples.manualReading(estate, asset, "TEMPERATURE", 5, T0.toInstant());
        var other = data.asset(estate, location);
        var otherDevice = data.device(estate, location, other, null);
        samples.reading(estate, other, otherDevice, "TEMPERATURE", 5, T0.toInstant());
        score(other, T0, 0.9);
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics.length()").value(0))
                .andExpect(jsonPath("$.anomalies.length()").value(0));
    }

    @Test
    void aggregatesTwoDevicesOfOneMetricIntoOneSeries() throws Exception {
        var second = data.device(estate, location, asset, null);
        reading(device, "TEMPERATURE", "10", T0);
        reading(second, "TEMPERATURE", "20", T0);
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics.length()").value(1))
                .andExpect(jsonPath("$.metrics[0].points.length()").value(1))
                .andExpect(jsonPath("$.metrics[0].points[0].min").value(10.0))
                .andExpect(jsonPath("$.metrics[0].points[0].max").value(20.0))
                .andExpect(jsonPath("$.metrics[0].points[0].avg").value(15.0))
                .andExpect(jsonPath("$.metrics[0].points[0].count").value(2));
    }

    @Test
    void bucketsAnomalyScoresWithTheirMaximumAndAbnormalCount() throws Exception {
        score(asset, T0.plusNanos(200_000_000), 0.3);
        score(asset, T0.plusNanos(700_000_000), 0.8);
        score(asset, T0.plusSeconds(5), 0.51);
        score(asset, T0.plusSeconds(30), 0.1);
        score(asset, T0.plusSeconds(60), 0.99);
        score(asset, T0.minusSeconds(1), 0.99);
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomalies.length()").value(3))
                .andExpect(jsonPath("$.anomalies[0].start").value("2026-11-07T12:00:00Z"))
                .andExpect(jsonPath("$.anomalies[0].maxScore").value(0.8))
                .andExpect(jsonPath("$.anomalies[0].abnormalCount").value(1))
                .andExpect(jsonPath("$.anomalies[1].start").value("2026-11-07T12:00:05Z"))
                .andExpect(jsonPath("$.anomalies[1].abnormalCount").value(1))
                .andExpect(jsonPath("$.anomalies[2].start").value("2026-11-07T12:00:30Z"))
                .andExpect(jsonPath("$.anomalies[2].maxScore").value(0.1))
                .andExpect(jsonPath("$.anomalies[2].abnormalCount").value(0));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "",
                "?from=2026-11-07T12:00:00Z",
                "?to=2026-11-07T12:00:00Z",
                "?from=bad&to=2026-11-07T12:00:00Z",
                "?from=2026-11-07T12:00:00Z&to=bad",
                "?from=2026-11-07T12:01:00Z&to=2026-11-07T12:00:00Z",
                "?from=2026-11-07T12:00:00Z&to=2026-11-07T12:00:00Z",
                "?from=2026-11-07T12:00:00Z&to=2026-11-08T12:00:00.001Z",
                MINUTE + "&metric=BAD"
            })
    void invalidQueriesAreBadRequests(String query) throws Exception {
        series(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings/series" + MINUTE))
                .andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void managersAndCrewCanRead(String role) throws Exception {
        member("reader", role);
        series("reader", MINUTE).andExpect(status().isOk());
    }

    @Test
    void residentsAreForbidden() throws Exception {
        member("resident", "RESIDENT");
        series("resident", MINUTE).andExpect(status().isForbidden());
    }

    @Test
    void unknownAndCrossEstateAssetsAreNotFound() throws Exception {
        var foreign = data.estateWithAsset("owner");
        mvc.perform(get("/estates/" + estate + "/assets/" + foreign[2] + "/readings/series" + MINUTE)
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + estate + "/assets/" + UUID.randomUUID() + "/readings/series" + MINUTE)
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + UUID.randomUUID() + "/assets/" + asset + "/readings/series" + MINUTE)
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        series("stranger", MINUTE).andExpect(status().isNotFound());
    }

    @Test
    void aRetiredAssetIsReadable() throws Exception {
        reading(device, "TEMPERATURE", "1", T0);
        db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ASSET.ID.eq(asset))
                .execute();
        series(MINUTE)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.metrics.length()").value(1));
    }

    void member(String user, String role) {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, user)
                .set(ESTATEUSER.ROLE, role)
                .execute();
    }
}
