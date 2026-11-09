package com.proj.server;

import static com.proj.server.AnomalyTestData.uniform;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.anomaly.AnomalyModel;
import com.proj.server.anomaly.AnomalyScorer;
import com.proj.server.anomaly.AnomalyScoringService;
import com.proj.server.anomaly.MlUnavailableException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Turning stored scores into assessments, and the trigger from both ingest paths. The model is replaced by one that
 * scores each sample with its raw vibration value, so tests choose the scores.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AnomalyAssessmentIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoSpyBean
    AnomalyScoringService scoring;

    @MockitoBean
    AnomalyScorer scorer;

    @MockitoBean
    JwtDecoder decoder;

    AnomalyTestData data;
    UUID estateId, locationId, assetId, deviceId;

    @BeforeEach
    void setup() {
        var devices = new DeviceTestData(db);
        data = new AnomalyTestData(db);
        var ids = devices.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = devices.device(estateId, locationId, assetId, null);
        doAnswer(invocation -> {
                    double[][] features = invocation.getArgument(0);
                    double[] scores = new double[features.length];
                    for (int i = 0; i < features.length; i++) {
                        scores[i] = features[i][0];
                    }
                    return scores;
                })
                .when(scorer)
                .scores(any());
    }

    static final Instant BASE = Instant.now().truncatedTo(ChronoUnit.SECONDS).minus(1, ChronoUnit.HOURS);

    static Instant t(long second) {
        return BASE.plusSeconds(second);
    }

    /** {@code count} samples one second apart from {@code from}, each scored {@code score}. */
    void samples(long from, int count, double score) {
        for (int i = 0; i < count; i++) {
            data.sample(estateId, assetId, deviceId, uniform(t(from + i), score));
        }
    }

    List<Record> assessments() {
        return db.fetch(
                "select condition, \"assessedOn\", notes, \"recordedByUserId\", \"recordedByName\" from \"AssetAssessment\" where \"assetId\" = ? order by \"createdAt\"",
                assetId);
    }

    void personAssessment(String condition, Instant createdAt, String userId) {
        db.execute(
                "insert into \"AssetAssessment\" (id, \"estateId\", \"assetId\", condition, \"assessedOn\", notes, \"recordedByUserId\", \"recordedByName\", \"createdAt\") values (?, ?, ?, ?, '2020-01-01', 'Checked', ?, 'Someone', ?::timestamptz)",
                UUID.randomUUID(),
                estateId,
                assetId,
                condition,
                userId,
                OffsetDateTime.ofInstant(createdAt, ZoneOffset.UTC));
    }

    @Test
    void aRunOfTenAbnormalSamplesRecordsNeedsAttention() {
        samples(0, 2, 0.1);
        samples(2, 10, 0.6);
        samples(12, 1, 0.1);

        scoring.pass(assetId);

        var rows = assessments();
        assertThat(rows).hasSize(1);
        var row = rows.getFirst();
        assertThat(row.get("condition", String.class)).isEqualTo("NEEDS_ATTENTION");
        assertThat(row.get("assessedOn", LocalDate.class)).isEqualTo(LocalDate.ofInstant(t(11), ZoneOffset.UTC));
        assertThat(row.get("recordedByUserId", String.class)).isEqualTo(AnomalyModel.SYSTEM_USER_ID);
        assertThat(row.get("recordedByName", String.class)).isEqualTo(AnomalyModel.SYSTEM_NAME);
        assertThat(row.get("notes", String.class))
                .isEqualTo(
                        "10 consecutive abnormal samples in device readings from %s to %s. Median score 0.60, maximum 0.60."
                                .formatted(t(2), t(11)));
    }

    /** The web reformats this exact template (spec asset-readings-charts, "Model assessment notes"). */
    @Test
    void modelNotesKeepTheTemplateTheWebParses() {
        for (int i = 0; i < 10; i++) {
            data.sample(estateId, assetId, deviceId, uniform(t(i).plusMillis(862), 0.6));
        }

        scoring.pass(assetId);

        String instant = "(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z)";
        assertThat(assessments().getFirst().get("notes", String.class))
                .matches("10 consecutive abnormal samples in device readings from " + instant + " to " + instant
                        + "\\. Median score 0\\.60, maximum 0\\.60\\.")
                .contains(t(0).plusMillis(862).toString(), t(9).plusMillis(862).toString());
    }

    @Test
    void nineAbnormalSamplesRecordNothing() {
        samples(0, 9, 0.99);

        scoring.pass(assetId);

        assertThat(assessments()).isEmpty();
    }

    @Test
    void aMedianOfTheFaultyThresholdRecordsFaulty() {
        samples(0, 5, 0.6);
        samples(5, 5, AnomalyModel.FAULTY_THRESHOLD);
        samples(10, 1, 0.99);

        scoring.pass(assetId);

        var row = assessments().getFirst();
        assertThat(row.get("condition", String.class)).isEqualTo("FAULTY");
        assertThat(row.get("notes", String.class)).contains("11 consecutive", "Median score 0.98, maximum 0.99.");
    }

    @Test
    void aRunSpansPassesAndIsRecordedOnceForItsCondition() {
        samples(0, 6, 0.6);
        scoring.pass(assetId);
        assertThat(assessments()).isEmpty();

        samples(6, 4, 0.6);
        scoring.pass(assetId);
        assertThat(assessments()).hasSize(1);

        // Same condition as now: nothing new.
        samples(10, 3, 0.6);
        scoring.pass(assetId);
        assertThat(assessments()).hasSize(1);

        // The run's median rises past the faulty threshold: the condition changes.
        samples(13, 20, 0.99);
        scoring.pass(assetId);
        assertThat(assessments())
                .extracting(r -> r.get("condition", String.class))
                .containsExactly("NEEDS_ATTENTION", "FAULTY");
    }

    @Test
    void aPassRecordsAtMostOneAssessmentForItsLongestRun() {
        samples(0, 12, 0.99);
        samples(12, 1, 0.1);
        samples(13, 10, 0.6);

        scoring.pass(assetId);

        assertThat(assessments())
                .extracting(r -> r.get("condition", String.class))
                .containsExactly("FAULTY");
    }

    @Test
    void aRunOnlyBeforeThisPassIsNotConsideredAgain() {
        samples(0, 12, 0.99);
        scoring.pass(assetId);
        db.execute(
                "delete from \"AssetAssessment\" where \"assetId\" = ? and \"recordedByUserId\" like 'system:%'",
                assetId);
        personAssessment("GOOD", Instant.EPOCH.plusSeconds(1), "owner");

        samples(13, 3, 0.1);
        scoring.pass(assetId);

        assertThat(assessments())
                .extracting(r -> r.get("recordedByUserId", String.class))
                .containsOnly("owner");
    }

    @Test
    void goodIsNeverRecorded() {
        personAssessment("FAULTY", Instant.EPOCH, "system:anomaly-model");
        samples(0, 30, 0.1);

        scoring.pass(assetId);

        assertThat(assessments()).hasSize(1);
    }

    @Test
    void onlySamplesMeasuredAfterAPersonsLatestAssessmentCount() {
        samples(0, 19, 0.99);
        // Recorded between t(9) and t(10), backdated to 2020: createdAt counts, not assessedOn.
        personAssessment("GOOD", t(9).plusMillis(500), "owner");

        scoring.pass(assetId);
        assertThat(assessments()).hasSize(1);

        samples(19, 1, 0.99);
        scoring.pass(assetId);

        var rows = assessments();
        assertThat(rows).hasSize(2);
        assertThat(rows.getLast().get("notes", String.class))
                .startsWith("10 consecutive abnormal samples in device readings from " + t(10));
    }

    @Test
    void aSystemAssessmentDoesNotReset() {
        samples(0, 5, 0.6);
        scoring.pass(assetId);
        personAssessment("GOOD", t(4).plusMillis(500), "system:other");

        samples(5, 5, 0.6);
        scoring.pass(assetId);

        assertThat(assessments())
                .extracting(r -> r.get("condition", String.class))
                .containsExactly("GOOD", "NEEDS_ATTENTION");
    }

    // --- The trigger from the ingest paths ---

    String key() throws Exception {
        new AnomalyTestData(db).allPumpMetrics(deviceId);
        var path = "/estates/" + estateId + "/assets/" + assetId + "/devices/" + deviceId + "/credential";
        var body = mvc.perform(post(path).with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.apiKey");
    }

    static final List<String[]> UNITS = List.of(
            new String[] {"VIBRATION_ACCELERATION", "g"},
            new String[] {"PRESSURE", "bar"},
            new String[] {"TEMPERATURE", "°C"},
            new String[] {"FLOW_RATE", "L/min"},
            new String[] {"POWER", "kW"});

    static List<String> items(Instant at, double value) {
        var items = new ArrayList<String>();
        for (var u : UNITS) {
            items.add("{\"metric\":\"%s\",\"value\":%s,\"unit\":\"%s\",\"measuredAt\":\"%s\"}"
                    .formatted(u[0], value, u[1], at));
        }
        return items;
    }

    String telemetry(String key, int samples) throws Exception {
        var items = new ArrayList<String>();
        for (int i = 0; i < samples; i++) {
            items.addAll(items(t(i), 0.2));
        }
        var body = "{\"readings\":[" + String.join(",", items) + "]}";
        mvc.perform(post("/device-api/telemetry")
                        .header("Authorization", "Bearer " + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").exists());
        return body;
    }

    void awaitScores(int count) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(15);
        while (data.scores(assetId).size() < count) {
            assertThat(System.nanoTime()).as("waiting for %d scores", count).isLessThan(deadline);
            Thread.sleep(50);
        }
    }

    @Test
    void telemetryScoresTheAssetAfterTheResponse() throws Exception {
        telemetry(key(), 12);

        awaitScores(12);
    }

    @Test
    void aSingleReadingScoresTheAssetToo() throws Exception {
        var key = key();
        for (var item : items(t(0), 0.2)) {
            mvc.perform(post("/device-api/readings")
                            .header("Authorization", "Bearer " + key)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(item))
                    .andExpect(status().isCreated());
        }

        awaitScores(1);
    }

    @Test
    void theDeviceResponseDoesNotWaitForScoring() throws Exception {
        var key = key();
        var release = new CountDownLatch(1);
        doAnswer(invocation -> {
                    release.await(15, TimeUnit.SECONDS);
                    double[][] features = invocation.getArgument(0);
                    return new double[features.length];
                })
                .when(scorer)
                .scores(any());

        // Returns while the model is still blocked.
        telemetry(key, 3);
        assertThat(data.scores(assetId)).isEmpty();
        release.countDown();
        awaitScores(3);
    }

    @Test
    void aScoringFailureDoesNotChangeTheDeviceResponse() throws Exception {
        doThrow(new MlUnavailableException("down", null)).when(scorer).scores(any());

        telemetry(key(), 3);

        verify(scoring, org.mockito.Mockito.timeout(5000)).pass(assetId);
        assertThat(data.scores(assetId)).isEmpty();
    }

    @Test
    void aRetryThatStoresNothingStartsNoPass() throws Exception {
        var key = key();
        var body = telemetry(key, 3);
        awaitScores(3);
        clearInvocations(scoring);

        mvc.perform(post("/device-api/telemetry")
                        .header("Authorization", "Bearer " + key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").value("ALREADY_STORED"));

        verify(scoring, after(1000).never()).pass(any());
    }
}
