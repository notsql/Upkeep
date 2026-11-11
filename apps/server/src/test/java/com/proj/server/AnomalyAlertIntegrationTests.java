package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willReturn;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.anomaly.AnomalyScorer;
import com.proj.server.anomaly.MlUnavailableException;
import com.proj.server.workos.WorkOSService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Anomaly alerts raised, updated and resolved by the anomaly check (ID-105, ID-106, spec notifications.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnomalyAlertIntegrationTests {
    static final Instant START = Instant.parse("2026-11-08T01:00:00Z");
    static final double LOW = 0.1;
    static final double NORMAL_VIBRATION = 0.0267;

    @MockitoBean
    AnomalyScorer scorer;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    UUID estateId, pumpId, liftId;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        var location = UUID.randomUUID();
        pumpId = UUID.randomUUID();
        liftId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                location,
                estateId);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, 'P-1', 'Booster pump', 'PUMP', now())",
                pumpId,
                estateId,
                location);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, 'L-1', 'Lift', 'LIFT', now())",
                liftId,
                estateId,
                location);
    }

    // ---- helpers -----------------------------------------------------------------------------------------------

    static String reading(Instant timestamp, double vibration) {
        return "{\"timestamp\":\"" + timestamp + "\",\"vibrationAcceleration\":" + vibration
                + ",\"pressure\":0.38,\"temperature\":73.8,\"flowRate\":32.0,\"power\":0.258}";
    }

    /** {@code n} readings one second apart from {@code from}; reading {@code odd} (or -1) is out of range. */
    static String batch(Instant from, int n, int odd) {
        List<String> readings = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            readings.add(reading(from.plusSeconds(i), i == odd ? 20.0 : NORMAL_VIBRATION));
        }
        return "{\"readings\":[" + String.join(",", readings) + "]}";
    }

    static String batch(Instant from, int n) {
        return batch(from, n, -1);
    }

    void score(List<Double> scores) {
        willReturn(scores.stream().mapToDouble(Double::doubleValue).toArray())
                .given(scorer)
                .scores(any());
    }

    /** {@code low} low scores, then {@code run} scores of {@code value}, then {@code tail} low scores. */
    static List<Double> scores(int low, int run, double value, int tail) {
        var scores = new ArrayList<Double>(Collections.nCopies(low, LOW));
        scores.addAll(Collections.nCopies(run, value));
        scores.addAll(Collections.nCopies(tail, LOW));
        return scores;
    }

    ResultActions check(UUID asset, String body) throws Exception {
        return mvc.perform(post("/estates/" + estateId + "/assets/" + asset + "/readings/anomaly-check")
                .with(jwt().jwt(j -> j.subject("owner")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    ResultActions check(String body) throws Exception {
        return check(pumpId, body);
    }

    List<Record> alerts() {
        return db.fetch(
                "select * from \"Notification\" where \"assetId\" = ? order by \"resolvedAt\" nulls last, id", pumpId);
    }

    Record alert() {
        var alerts = alerts();
        assertEquals(1, alerts.size());
        return alerts.getFirst();
    }

    void threshold(String value) {
        db.execute(
                "insert into \"EstateNotificationSettings\" (\"estateId\", \"anomalyScoreThreshold\", \"serviceLeadDays\", \"repairLeadDays\", \"updatedByUserId\") values (?, ?::numeric, 14, 30, 'owner')",
                estateId,
                value);
    }

    static double number(Record record, String field) {
        return record.get(field, BigDecimal.class).doubleValue();
    }

    // ---- ID-105: raising an alert --------------------------------------------------------------------------------

    @Test
    void aQualifyingRunRaisesAnUnreadAlert() throws Exception {
        score(scores(5, 10, 0.7, 5));
        check(batch(START, 20)).andExpect(status().isOk());

        var alert = alert();
        assertEquals("ANOMALY", alert.get("type"));
        assertEquals(estateId, alert.get("estateId"));
        assertEquals("NEEDS_ATTENTION", alert.get("condition"));
        assertEquals(0.7, number(alert, "medianScore"), 1e-9);
        assertEquals(0.7, number(alert, "maxScore"), 1e-9);
        assertEquals(
                START.plusSeconds(5),
                alert.get("firstDetectedAt", OffsetDateTime.class).toInstant());
        assertEquals(
                START.plusSeconds(14),
                alert.get("lastDetectedAt", OffsetDateTime.class).toInstant());
        assertEquals(
                "10 consecutive abnormal readings from 2026-11-08T01:00:05Z to 2026-11-08T01:00:14Z. Median score 0.70, maximum 0.70.",
                alert.get("explanation"));
        assertEquals("Abnormal readings: needs attention", alert.get("summary"));
        assertEquals("NONE", alert.get("response"));
        assertNull(alert.get("resolvedAt"));

        mvc.perform(get("/notifications/unread-count").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void aFaultyRunSaysSo() throws Exception {
        var scores = scores(0, 10, 0.99, 0);
        scores.set(9, 1.0);
        score(scores);
        check(batch(START, 10));
        var alert = alert();
        assertEquals("FAULTY", alert.get("condition"));
        assertEquals("Abnormal readings: faulty", alert.get("summary"));
        assertEquals(0.99, number(alert, "medianScore"), 1e-9);
        assertEquals(1.0, number(alert, "maxScore"), 1e-9);
    }

    @Test
    void anAlertIsRaisedEvenWhenTheConditionIsAlreadyRecorded() throws Exception {
        score(scores(0, 10, 0.7, 0));
        check(batch(START, 10)).andExpect(jsonPath("$.conditionRecorded").value("NEEDS_ATTENTION"));
        check(batch(START.plusSeconds(3600), 10))
                .andExpect(jsonPath("$.conditionRecorded").doesNotExist());
        db.execute("update \"Notification\" set \"resolvedAt\" = now() where \"assetId\" = ?", pumpId);
        check(batch(START.plusSeconds(7200), 10));
        assertEquals(2, alerts().size());
    }

    @Test
    void aRunBelowTheEstatesThresholdRaisesNothing() throws Exception {
        threshold("0.90");
        score(scores(0, 10, 0.89, 0));
        check(batch(START, 10)).andExpect(status().isOk());
        assertEquals(0, alerts().size());

        score(scores(0, 10, 0.90, 0));
        check(batch(START.plusSeconds(60), 10));
        assertEquals(1, alerts().size());
    }

    @Test
    void anOutOfRangeReadingInTheRunRaisesNothing() throws Exception {
        score(scores(5, 10, 0.7, 5));
        check(batch(START, 20, 9)).andExpect(status().isOk());
        assertEquals(0, alerts().size());
    }

    @Test
    void anOutOfRangeReadingOutsideTheRunDoesNotMatter() throws Exception {
        score(scores(5, 10, 0.7, 5));
        check(batch(START, 20, 2));
        assertEquals(1, alerts().size());
    }

    @Test
    void aFailedCheckRaisesNothing() throws Exception {
        given(scorer.scores(any())).willThrow(new MlUnavailableException("down", null));
        check(batch(START, 10)).andExpect(status().isServiceUnavailable());
        score(scores(0, 10, 0.7, 0));
        check(liftId, batch(START, 10)).andExpect(status().isConflict());
        assertEquals(0, alerts().size());
        assertEquals(0L, ((Number) db.fetchValue("select count(*) from \"Notification\"")).longValue());
    }

    // ---- ID-106: one alert per ongoing anomaly -----------------------------------------------------------------

    @Test
    void anOngoingAnomalyUpdatesTheOpenAlertWithoutMakingItUnread() throws Exception {
        score(scores(0, 10, 0.7, 0));
        check(batch(START, 10));
        var first = alert();
        mvc.perform(post("/notifications/" + first.get("id") + "/read").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNoContent());

        score(scores(0, 12, 0.99, 0));
        check(batch(START.plusSeconds(600), 12));

        var updated = alert();
        assertEquals(first.get("id"), updated.get("id"));
        assertEquals(first.get("createdAt", OffsetDateTime.class), updated.get("createdAt", OffsetDateTime.class));
        assertEquals(0.99, number(updated, "medianScore"), 1e-9);
        assertEquals("FAULTY", updated.get("condition"));
        assertEquals("Abnormal readings: faulty", updated.get("summary"));
        assertEquals(START, updated.get("firstDetectedAt", OffsetDateTime.class).toInstant());
        assertEquals(
                START.plusSeconds(611),
                updated.get("lastDetectedAt", OffsetDateTime.class).toInstant());
        assertNull(updated.get("resolvedAt"));
        mvc.perform(get("/notifications/unread-count").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void anOlderBatchDoesNotMoveLastDetectedBack() throws Exception {
        score(scores(0, 10, 0.7, 0));
        check(batch(START.plusSeconds(600), 10));
        check(batch(START, 10));
        assertEquals(
                START.plusSeconds(609),
                alert().get("lastDetectedAt", OffsetDateTime.class).toInstant());
    }

    @Test
    void aNormalBatchResolvesTheAlertAndALaterDriftRaisesANewOne() throws Exception {
        score(scores(0, 10, 0.7, 0));
        check(batch(START, 10));

        score(scores(20, 0, 0, 0));
        check(batch(START.plusSeconds(60), 20));
        assertNotNull(alert().get("resolvedAt"));

        score(scores(0, 10, 0.7, 0));
        check(batch(START.plusSeconds(120), 10));
        var alerts = alerts();
        assertEquals(2, alerts.size());
        assertNotNull(alerts.get(0).get("resolvedAt"));
        assertNull(alerts.get(1).get("resolvedAt"));
    }

    @Test
    void aShortAbnormalRunCountsAsNormal() throws Exception {
        score(scores(0, 10, 0.7, 0));
        check(batch(START, 10));
        score(scores(5, 9, 0.99, 6));
        check(batch(START.plusSeconds(60), 20));
        assertNotNull(alert().get("resolvedAt"));
    }

    @Test
    void anAbnormalBatchThatDoesNotQualifyLeavesTheOpenAlertAlone() throws Exception {
        score(scores(0, 10, 0.95, 0));
        check(batch(START, 10));
        var before = alert();
        threshold("0.96");

        score(scores(0, 10, 0.7, 0));
        check(batch(START.plusSeconds(60), 10));
        score(scores(5, 10, 0.99, 5));
        check(batch(START.plusSeconds(120), 20, 7));

        var after = alert();
        assertNull(after.get("resolvedAt"));
        assertEquals(number(before, "medianScore"), number(after, "medianScore"), 1e-9);
        assertEquals(
                before.get("lastDetectedAt", OffsetDateTime.class), after.get("lastDetectedAt", OffsetDateTime.class));
    }

    @Test
    void aNormalBatchWithNoOpenAlertDoesNothing() throws Exception {
        score(scores(10, 0, 0, 0));
        check(batch(START, 10)).andExpect(status().isOk());
        assertEquals(0, alerts().size());
    }
}
