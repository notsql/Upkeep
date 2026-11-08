package com.proj.server;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.anomaly.AnomalyModel;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
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

/** The ANOMALY reading flag (spec streaming-anomaly-detection, "Anomaly flag on readings"). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AnomalyReadingFlagIntegrationTests {
    static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    com.proj.server.workos.WorkOSService workOS;

    AnomalyTestData samples;
    UUID estate, location, asset, device;

    @BeforeEach
    void setup() {
        var data = new DeviceTestData(db);
        samples = new AnomalyTestData(db);
        var ids = data.estateWithAsset("anomaly-owner");
        estate = ids[0];
        location = ids[1];
        asset = ids[2];
        device = data.device(estate, location, asset, null);
        samples.allPumpMetrics(device);
        // A long interval keeps GAP out of the way.
        db.execute("update \"Device\" set \"reportingIntervalSeconds\" = 86400 where id = ?", device);
    }

    @AfterEach
    void cleanup() {
        db.deleteFrom(ANOMALYSCORE).where(ANOMALYSCORE.ESTATEID.eq(estate)).execute();
        db.deleteFrom(DEVICEREADING).where(DEVICEREADING.ESTATEID.eq(estate)).execute();
        db.deleteFrom(MANUALREADING).where(MANUALREADING.ESTATEID.eq(estate)).execute();
        db.deleteFrom(DEVICE).where(DEVICE.ESTATEID.eq(estate)).execute();
        db.deleteFrom(ASSET).where(ASSET.ESTATEID.eq(estate)).execute();
        db.deleteFrom(LOCATION).where(LOCATION.ESTATEID.eq(estate)).execute();
        db.deleteFrom(ESTATEUSER).where(ESTATEUSER.ESTATEID.eq(estate)).execute();
        db.deleteFrom(ESTATE).where(ESTATE.ID.eq(estate)).execute();
    }

    /** All five pump readings at {@code at}, with in-range values. */
    void sample(Instant at) {
        samples.sample(estate, asset, device, AnomalyTestData.uniform(at, 1.0));
    }

    void score(Instant at, double score) {
        db.insertInto(ANOMALYSCORE)
                .set(ANOMALYSCORE.ID, UUID.randomUUID())
                .set(ANOMALYSCORE.ESTATEID, estate)
                .set(ANOMALYSCORE.ASSETID, asset)
                .set(ANOMALYSCORE.MEASUREDAT, OffsetDateTime.ofInstant(at, ZoneOffset.UTC))
                .set(ANOMALYSCORE.SCORE, score)
                .set(ANOMALYSCORE.SCOREDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .execute();
    }

    ResultActions assetReadings(String query) throws Exception {
        return mvc.perform(get("/estates/" + estate + "/assets/" + asset + "/readings" + query)
                        .with(jwt().jwt(j -> j.subject("anomaly-owner"))))
                .andExpect(status().isOk());
    }

    ResultActions estateReadings(String user, String query) throws Exception {
        return mvc.perform(get("/estates/" + estate + "/readings" + query).with(jwt().jwt(j -> j.subject(user))))
                .andExpect(status().isOk());
    }

    String export(String query) throws Exception {
        var result = mvc.perform(get("/estates/" + estate + "/readings/export" + query)
                        .with(jwt().jwt(j -> j.subject("anomaly-owner"))))
                .andExpect(status().isOk())
                .andReturn();
        result.getAsyncResult(20000);
        return mvc.perform(asyncDispatch(result))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    static String at(Instant t) {
        return "$.items[?(@.measuredAt == '" + t + "')]";
    }

    @Test
    void everyReadingOfAnAbnormalSampleCarriesAnomalyWithItsScore() throws Exception {
        sample(T0);
        score(T0, 0.87);
        assetReadings("?size=50")
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath("$.items[*].flags[*]", hasSize(5)))
                .andExpect(jsonPath(
                        "$.items[*].flags[0].type",
                        containsInAnyOrder("ANOMALY", "ANOMALY", "ANOMALY", "ANOMALY", "ANOMALY")))
                .andExpect(
                        jsonPath("$.items[*].flags[0].anomalyScore", containsInAnyOrder(0.87, 0.87, 0.87, 0.87, 0.87)));
    }

    @Test
    void aScoreExactlyAtTheThresholdIsAnomalous() throws Exception {
        sample(T0);
        score(T0, AnomalyModel.DECISION_THRESHOLD);
        assetReadings("?flag=ANOMALY")
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath("$.items[0].flags[0].anomalyScore").value(0.51));
    }

    @Test
    void belowTheThresholdOrUnscoredOrManualReadingsCarryNoFlag() throws Exception {
        var below = T0;
        var unscored = T0.plusSeconds(1);
        var manual = T0.plusSeconds(2);
        sample(below);
        score(below, 0.5099);
        sample(unscored);
        samples.manualReading(estate, asset, "PRESSURE", 1.0, manual);
        // A score at the manual reading's instant must not flag it.
        score(manual, 0.99);
        assetReadings("?size=50")
                .andExpect(jsonPath("$.totalItems").value(11))
                .andExpect(jsonPath("$.items[*].flags[*]", hasSize(0)));
        assetReadings("?flag=ANOMALY").andExpect(jsonPath("$.totalItems").value(0));
    }

    @Test
    void otherFlagTypesCarryNoAnomalyScore() throws Exception {
        samples.reading(estate, asset, device, "TEMPERATURE", 999, T0);
        score(T0, 0.9);
        assetReadings("")
                .andExpect(jsonPath("$.items[0].flags.length()").value(2))
                .andExpect(jsonPath("$.items[0].flags[?(@.type == 'OUT_OF_RANGE')].anomalyScore")
                        .isEmpty())
                .andExpect(jsonPath("$.items[0].flags[?(@.type == 'ANOMALY')].anomalyScore")
                        .value(0.9));
    }

    /** One anomalous sample, one out-of-range reading, one clean sample. */
    void mixed() {
        sample(T0);
        score(T0, 0.9);
        samples.reading(estate, asset, device, "TEMPERATURE", 999, T0.plusSeconds(1));
        score(T0.plusSeconds(1), 0.1);
        sample(T0.plusSeconds(2));
        score(T0.plusSeconds(2), 0.2);
    }

    @Test
    void assetReadingsFilterOnAnomalyAloneAndAsMatchAny() throws Exception {
        mixed();
        assetReadings("?flag=ANOMALY")
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath(at(T0) + ".id", hasSize(5)));
        assetReadings("?flag=ANOMALY&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.totalItems").value(6));
        // "Suspect only" sends the three suspect-data flags; it must not pick up ANOMALY.
        assetReadings("?flag=GAP&flag=DUPLICATE_TIMESTAMP&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void estateReadingsFilterOnAnomalyAloneAndAsMatchAny() throws Exception {
        mixed();
        estateReadings("anomaly-owner", "?flag=ANOMALY&size=50")
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath(
                        "$.items[*].flags[0].type",
                        containsInAnyOrder("ANOMALY", "ANOMALY", "ANOMALY", "ANOMALY", "ANOMALY")));
        estateReadings("anomaly-owner", "?flag=ANOMALY&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.totalItems").value(6));
        estateReadings("anomaly-owner", "?flag=GAP&flag=DUPLICATE_TIMESTAMP&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void csvExportListsAnomalyAndFiltersOnIt() throws Exception {
        mixed();
        var all = export("");
        assertThat(all.lines().filter(line -> line.endsWith(",\"ANOMALY\""))).hasSize(5);
        var anomalous = export("?flag=ANOMALY").lines().skip(1).toList();
        assertThat(anomalous).hasSize(5).allMatch(line -> line.endsWith(",\"ANOMALY\""));
        var either = export("?flag=ANOMALY&flag=OUT_OF_RANGE").lines().skip(1).toList();
        assertThat(either).hasSize(6);
        assertThat(either.stream().filter(line -> line.endsWith(",\"OUT_OF_RANGE\"")))
                .hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void managersAndCrewSeeTheFlag(String role) throws Exception {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, "anomaly-reader")
                .set(ESTATEUSER.ROLE, role)
                .execute();
        sample(T0);
        score(T0, 0.9);
        estateReadings("anomaly-reader", "?flag=ANOMALY")
                .andExpect(jsonPath("$.totalItems").value(5));
    }
}
