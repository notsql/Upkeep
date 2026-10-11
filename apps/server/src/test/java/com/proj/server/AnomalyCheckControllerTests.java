package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.Record;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/**
 * POST /estates/{estateId}/assets/{assetId}/readings/anomaly-check against a real (Testcontainers) database, because
 * recording an assessment and the no-duplicate rule depend on stored state. apps/ml is replaced by a JDK HttpServer
 * that answers {@code POST /predict} in apps/ml's shape with scores the test chooses; its URL is injected as
 * {@code ML_API_URL}.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnomalyCheckControllerTests {

    /** Stand-in for apps/ml. Tests set its behaviour in {@link #setup()} and per test. */
    static final class MlStub {
        final HttpServer server;
        volatile List<Double> scores = List.of();
        volatile int status = 200;
        volatile long delayMillis = 0;
        volatile String lastBody;
        volatile int calls;

        MlStub() throws IOException {
            server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
            server.setExecutor(Executors.newCachedThreadPool());
            server.createContext("/predict", exchange -> {
                try (InputStream in = exchange.getRequestBody()) {
                    lastBody = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
                calls++;
                if (delayMillis > 0) {
                    try {
                        Thread.sleep(delayMillis);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
                String body = status == 200 ? predictResponse() : "{\"detail\":\"No model is loaded\"}";
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                try {
                    exchange.sendResponseHeaders(status, bytes.length);
                    try (OutputStream out = exchange.getResponseBody()) {
                        out.write(bytes);
                    }
                } catch (IOException ignored) {
                    // The client gave up (timeout test); nothing to answer.
                }
            });
            server.start();
        }

        /**
         * apps/ml's /predict response for the ONNX model: {"outputs":{"label":[..],"probabilities":[[p0,p1],..]}},
         * column 1 being the anomaly probability.
         */
        private String predictResponse() {
            String labels = scores.stream().map(s -> s >= 0.5 ? "1" : "0").collect(Collectors.joining(","));
            String probabilities = scores.stream()
                    .map(s -> "[" + (1 - s) + "," + s + "]")
                    .collect(Collectors.joining(","));
            return "{\"outputs\":{\"label\":[" + labels + "],\"probabilities\":[" + probabilities + "]}}";
        }

        String url() {
            return "http://" + server.getAddress().getHostString() + ":" + server.getAddress().getPort();
        }
    }

    static final MlStub ML = startStub();

    private static MlStub startStub() {
        try {
            return new MlStub();
        } catch (IOException e) {
            throw new IllegalStateException("Could not start the apps/ml stub", e);
        }
    }

    @DynamicPropertySource
    static void mlApiUrl(DynamicPropertyRegistry registry) {
        registry.add("ML_API_URL", ML::url);
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId, locationId, pumpId, liftId;

    /** 2026-03-01 23:59:50Z: runs placed after reading 10 end after midnight, on 2026-03-02. */
    static final Instant START = Instant.parse("2026-03-01T23:59:50Z");

    static final double LOW = 0.1;

    @BeforeEach
    void setup() {
        ML.scores = List.of();
        ML.status = 200;
        ML.delayMillis = 0;
        ML.lastBody = null;
        ML.calls = 0;

        estateId = UUID.randomUUID();
        locationId = UUID.randomUUID();
        pumpId = UUID.randomUUID();
        liftId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                locationId,
                estateId);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, 'E-A0001', 'Booster pump', 'PUMP', '2020-01-01', now())",
                pumpId,
                estateId,
                locationId);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, 'E-A0002', 'Lift', 'LIFT', '2020-01-01', now())",
                liftId,
                estateId,
                locationId);
    }

    // ---- helpers -----------------------------------------------------------------------------------------------

    private String url(UUID estate, UUID asset) {
        return "/estates/" + estate + "/assets/" + asset + "/readings/anomaly-check";
    }

    private ResultActions check(String subject, UUID estate, UUID asset, String body) throws Exception {
        return mvc.perform(post(url(estate, asset))
                .with(jwt().jwt(j -> j.subject(subject)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private ResultActions check(String body) throws Exception {
        return check("owner", estateId, pumpId, body);
    }

    private static String reading(Instant timestamp) {
        return "{\"timestamp\":\"" + timestamp + "\",\"vibrationAcceleration\":0.0267,\"pressure\":0.38,"
                + "\"temperature\":73.8,\"flowRate\":32.0,\"power\":0.258}";
    }

    /** {@code n} valid readings one second apart from {@link #START}. */
    private static List<String> readings(int n) {
        List<String> readings = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            readings.add(reading(START.plusSeconds(i)));
        }
        return readings;
    }

    private static String batch(List<String> readings) {
        return "{\"readings\":[" + String.join(",", readings) + "]}";
    }

    private static List<Double> scores(int n, double score) {
        return new ArrayList<>(Collections.nCopies(n, score));
    }

    private List<Record> assessments() {
        return db.fetch(
                "select * from \"AssetAssessment\" where \"assetId\" = ? order by \"assessedOn\", \"createdAt\"",
                pumpId);
    }

    private void assessment(String condition, String date) {
        db.execute(
                "insert into \"AssetAssessment\" (id, \"estateId\", \"assetId\", condition, \"assessedOn\", notes, \"recordedByUserId\") values (?, ?, ?, ?, ?::date, 'Inspection', 'owner')",
                UUID.randomUUID(),
                estateId,
                pumpId,
                condition,
                date);
    }

    /**
     * 20 readings: a short abnormal run of 3 (indexes 2-4), a reading just below the decision threshold (5), then a
     * run of 10 (indexes 6-15, 2026-03-01T23:59:56Z to 2026-03-02T00:00:05Z), then normal readings.
     */
    private static List<Double> withRunOfTen(List<Double> run) {
        List<Double> scores = scores(20, LOW);
        scores.set(2, 0.9);
        scores.set(3, 0.9);
        scores.set(4, 0.9);
        scores.set(5, 0.50);
        for (int i = 0; i < 10; i++) {
            scores.set(6 + i, run.get(i));
        }
        return scores;
    }

    /** Median 0.97 (< 0.98), max 0.99, includes 0.51 (abnormal at the threshold): NEEDS_ATTENTION. */
    static final List<Double> NEEDS_ATTENTION_RUN = List.of(0.51, 0.99, 0.51, 0.97, 0.99, 0.51, 0.97, 0.99, 0.51, 0.99);

    /** Median 0.98 (reaches the Faulty threshold) although the mean is only 0.832: FAULTY. */
    static final List<Double> FAULTY_RUN = List.of(0.6, 0.99, 0.6, 0.98, 0.99, 0.6, 0.98, 0.99, 0.6, 0.99);

    // ---- recording a condition ----------------------------------------------------------------------------------

    @Test
    void tenAbnormalReadingsInARowWithAMedianBelowFaultyRecordNeedsAttention() throws Exception {
        ML.scores = withRunOfTen(NEEDS_ATTENTION_RUN);

        check(batch(readings(20)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readingsScored").value(20))
                .andExpect(jsonPath("$.abnormalReadings").value(13))
                .andExpect(jsonPath("$.longestAbnormalRun").value(10))
                .andExpect(jsonPath("$.maxScore").value(0.99))
                .andExpect(jsonPath("$.conditionRecorded").value("NEEDS_ATTENTION"));

        List<Record> recorded = assessments();
        assertEquals(1, recorded.size());
        assertEquals("NEEDS_ATTENTION", recorded.getFirst().get("condition", String.class));
        assertTrue(ML.lastBody.contains("\"inputs\"") && ML.lastBody.contains("\"input\""), ML.lastBody);
    }

    @Test
    void tenAbnormalReadingsInARowWithAMedianReachingFaultyRecordFaulty() throws Exception {
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.longestAbnormalRun").value(10))
                .andExpect(jsonPath("$.conditionRecorded").value("FAULTY"));

        List<Record> recorded = assessments();
        assertEquals(1, recorded.size());
        assertEquals("FAULTY", recorded.getFirst().get("condition", String.class));
    }

    @Test
    void recordsAsTheAnomalyModelDatedTheRunsLastReadingWithTheRunInTheNotes() throws Exception {
        ML.scores = withRunOfTen(NEEDS_ATTENTION_RUN);

        check(batch(readings(20))).andExpect(status().isOk());

        Record recorded = assessments().getFirst();
        assertEquals("system:anomaly-model", recorded.get("recordedByUserId", String.class));
        assertEquals("Anomaly detection", recorded.get("recordedByName", String.class));
        // The run's last reading is 2026-03-02T00:00:05Z; the batch started the day before.
        assertEquals("2026-03-02", recorded.get("assessedOn").toString());
        String notes = recorded.get("notes", String.class);
        assertTrue(notes.contains("10"), "run length: " + notes);
        assertTrue(notes.contains("0.97"), "median score: " + notes);
        assertTrue(notes.contains("0.99"), "maximum score: " + notes);
        assertTrue(notes.contains("2026-03-01T23:59:56Z"), "run start: " + notes);
        assertTrue(notes.contains("2026-03-02T00:00:05Z"), "run end: " + notes);
    }

    @Test
    void nineAbnormalReadingsInARowRecordNothing() throws Exception {
        // Two runs of 9 separated by one normal reading: 18 abnormal, but never 10 in a row.
        List<Double> scores = scores(20, 0.99);
        scores.set(0, LOW);
        scores.set(10, LOW);
        ML.scores = scores;

        check(batch(readings(20)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readingsScored").value(20))
                .andExpect(jsonPath("$.abnormalReadings").value(18))
                .andExpect(jsonPath("$.longestAbnormalRun").value(9))
                .andExpect(jsonPath("$.conditionRecorded").isEmpty());

        assertEquals(0, assessments().size());
    }

    @Test
    void doesNotRecordTheSameConditionTwice() throws Exception {
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20))).andExpect(status().isOk()).andExpect(jsonPath("$.conditionRecorded").value("FAULTY"));
        check(batch(readings(20)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.longestAbnormalRun").value(10))
                .andExpect(jsonPath("$.conditionRecorded").isEmpty());

        assertEquals(1, assessments().size());
    }

    @Test
    void doesNotDuplicateAPersonsCurrentAssessment() throws Exception {
        assessment("FAULTY", "2026-02-01");
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20))).andExpect(status().isOk()).andExpect(jsonPath("$.conditionRecorded").isEmpty());

        assertEquals(1, assessments().size());
    }

    @Test
    void recordsWhenTheCurrentConditionDiffers() throws Exception {
        // FAULTY in the past, but the current (latest) condition is GOOD.
        assessment("FAULTY", "2026-01-01");
        assessment("GOOD", "2026-02-01");
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20))).andExpect(status().isOk()).andExpect(jsonPath("$.conditionRecorded").value("FAULTY"));

        assertEquals(3, assessments().size());
    }

    // ---- 400s ---------------------------------------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(ints = {10, 3600})
    void acceptsBatchesAtTheSizeLimits(int size) throws Exception {
        ML.scores = scores(size, LOW);

        check(batch(readings(size)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readingsScored").value(size))
                .andExpect(jsonPath("$.conditionRecorded").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 9, 3601})
    void rejectsBatchesOutsideTheSizeLimits(int size) throws Exception {
        ML.scores = scores(size, 0.99);

        check(batch(readings(size))).andExpect(status().isBadRequest());

        assertEquals(0, assessments().size());
    }

    @Test
    void rejectsAMissingReadingsList() throws Exception {
        check("{}").andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {"timestamp", "vibrationAcceleration", "pressure", "temperature", "flowRate", "power"})
    void rejectsAMissingValue(String field) throws Exception {
        ML.scores = scores(10, 0.99);
        List<String> readings = readings(10);
        // Drop the field from the fifth reading.
        readings.set(4, readings.get(4).replaceFirst(",?\"" + field + "\":[^,}]+", "").replace("{,", "{"));

        check(batch(readings)).andExpect(status().isBadRequest());

        assertEquals(0, assessments().size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "1e999", "-1e999", "\"NaN\"", "\"Infinity\""})
    void rejectsANullOrNonFiniteValue(String value) throws Exception {
        ML.scores = scores(10, 0.99);
        List<String> readings = readings(10);
        readings.set(4, readings.get(4).replace("\"pressure\":0.38", "\"pressure\":" + value));

        check(batch(readings)).andExpect(status().isBadRequest());

        assertEquals(0, assessments().size());
    }

    @Test
    void sortsReadingsByTimestampBeforeChecking() throws Exception {
        ML.scores = scores(10, LOW);
        List<String> readings = readings(10);
        Collections.reverse(readings);

        check(batch(readings)).andExpect(status().isOk()).andExpect(jsonPath("$.readingsScored").value(10));
    }

    @Test
    void rejectsDuplicateTimestamps() throws Exception {
        ML.scores = scores(10, 0.99);
        List<String> readings = readings(10);
        readings.set(5, reading(START.plusSeconds(4)));

        check(batch(readings)).andExpect(status().isBadRequest());

        assertEquals(0, assessments().size());
    }

    @Test
    void acceptsAGapOfTwoSeconds() throws Exception {
        ML.scores = scores(10, LOW);
        List<String> readings = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            readings.add(reading(START.plusSeconds(2L * i)));
        }

        check(batch(readings)).andExpect(status().isOk());
    }

    @Test
    void rejectsAGapOverTwoSeconds() throws Exception {
        ML.scores = scores(10, 0.99);
        List<String> readings = readings(10);
        for (int i = 5; i < 10; i++) {
            // 2.5 s between the fifth and sixth readings.
            readings.set(i, reading(START.plusSeconds(i).plusMillis(500)));
        }

        check(batch(readings)).andExpect(status().isBadRequest());

        assertEquals(0, assessments().size());
    }

    // ---- 404s and 409s ------------------------------------------------------------------------------------------

    @Test
    void anotherUserGetsNotFound() throws Exception {
        ML.scores = withRunOfTen(FAULTY_RUN);

        check("outsider", estateId, pumpId, batch(readings(20))).andExpect(status().isNotFound());

        assertEquals(0, assessments().size());
    }

    @Test
    void unknownEstateOrAssetIsNotFound() throws Exception {
        ML.scores = scores(10, LOW);

        check("owner", UUID.randomUUID(), pumpId, batch(readings(10))).andExpect(status().isNotFound());
        check("owner", estateId, UUID.randomUUID(), batch(readings(10))).andExpect(status().isNotFound());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(post(url(estateId, pumpId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(batch(readings(10))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aNonPumpAssetIsAConflict() throws Exception {
        ML.scores = scores(10, LOW);

        check("owner", estateId, liftId, batch(readings(10))).andExpect(status().isConflict());
    }

    @Test
    void aDeactivatedAssetIsAConflict() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", pumpId);
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20))).andExpect(status().isConflict());

        assertEquals(0, assessments().size());
    }

    @Test
    void anInactiveEstateIsAConflict() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        ML.scores = withRunOfTen(FAULTY_RUN);

        check(batch(readings(20))).andExpect(status().isConflict());

        assertEquals(0, assessments().size());
    }

    // ---- apps/ml failing ----------------------------------------------------------------------------------------

    @Test
    void mlServiceUnavailableGivesServiceUnavailableAndRecordsNothing() throws Exception {
        ML.status = 503;

        check(batch(readings(20))).andExpect(status().isServiceUnavailable());

        assertEquals(1, ML.calls, "the batch was sent to apps/ml");
        assertEquals(0, assessments().size());
    }

    @Test
    void mlServiceTimeoutGivesServiceUnavailableAndRecordsNothing() throws Exception {
        // Over the 5-second timeout.
        ML.scores = withRunOfTen(FAULTY_RUN);
        ML.delayMillis = 6_500;

        check(batch(readings(20))).andExpect(status().isServiceUnavailable());

        assertEquals(0, assessments().size());
    }
}
