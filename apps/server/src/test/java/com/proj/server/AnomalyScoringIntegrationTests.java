package com.proj.server;

import static com.proj.server.AnomalyTestData.uniform;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;

import com.proj.server.anomaly.AnomalyCheckRequest;
import com.proj.server.anomaly.AnomalyFeatureBuilder;
import com.proj.server.anomaly.AnomalyModel;
import com.proj.server.anomaly.AnomalyScorer;
import com.proj.server.anomaly.AnomalyScoringService;
import com.proj.server.anomaly.MlUnavailableException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Scoring stored readings with the real model: samples, segments, the cap, failure and serialisation. Not
 * transactional, because a pass commits its own transaction; every test seeds its own estate.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AnomalyScoringIntegrationTests {
    static final double PARITY = 1e-6;

    @Autowired
    DSLContext db;

    @Autowired
    AnomalyScoringService scoring;

    @Autowired
    AnomalyFeatureBuilder features;

    @MockitoSpyBean
    AnomalyScorer scorer;

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
    }

    /** What the anomaly-check path scores for these readings as one batch. */
    double[] checkPath(List<AnomalyCheckRequest.Reading> readings) {
        return scorer.scores(features.build(readings));
    }

    void store(List<AnomalyCheckRequest.Reading> readings) {
        for (var r : readings) {
            data.sample(estateId, assetId, deviceId, r);
        }
    }

    static Instant t(long second) {
        return Instant.parse("2026-01-01T00:00:00Z").plusSeconds(second);
    }

    /** Samples one second apart from {@code from}, with distinct values so windows matter. */
    static List<AnomalyCheckRequest.Reading> run(long from, int count) {
        var list = new ArrayList<AnomalyCheckRequest.Reading>();
        for (int i = 0; i < count; i++) {
            list.add(uniform(t(from + i), 1 + ((from + i) % 7) * 0.1));
        }
        return list;
    }

    @Test
    void aStoredSegmentScoresAsTheAnomalyCheckPathScoresIt() throws Exception {
        var readings = AnomalyTestData.fixtureReadings();
        store(readings);

        assertThat(scoring.pass(assetId)).isEqualTo(readings.size());

        double[] expected = checkPath(readings);
        var stored = data.scores(assetId);
        assertThat(stored).hasSize(readings.size());
        for (int i = 0; i < expected.length; i++) {
            assertThat(stored.get(i).measuredAt()).isEqualTo(readings.get(i).timestamp());
            assertEquals(expected[i], stored.get(i).score(), PARITY, "sample " + i);
        }
    }

    @Test
    void onlyTimestampsWithExactlyOneDeviceReadingPerMetricAreSamples() {
        store(run(0, 3));
        // t(3): no POWER. t(4): two devices send TEMPERATURE. t(5): only manual readings.
        for (var metric : List.of("VIBRATION_ACCELERATION", "PRESSURE", "TEMPERATURE", "FLOW_RATE")) {
            data.reading(estateId, assetId, deviceId, metric, 1, t(3));
        }
        data.sample(estateId, assetId, deviceId, uniform(t(4), 1));
        var second = new DeviceTestData(db).device(estateId, locationId, assetId, null);
        data.reading(estateId, assetId, second, "TEMPERATURE", 2, t(4));
        for (var metric : AnomalyTestData.METRICS) {
            data.manualReading(estateId, assetId, metric, 1, t(5));
        }

        scoring.pass(assetId);

        assertThat(data.scores(assetId))
                .extracting(AnomalyTestData.Score::measuredAt)
                .containsExactly(t(0), t(1), t(2));
    }

    @Test
    void aGapOverMaxGapStartsANewSegmentAndRestartsTheWindow() {
        var first = run(0, 12);
        // 3 s after the last sample of the first segment.
        var second = run(14, 12);
        var all = new ArrayList<>(first);
        all.addAll(second);
        store(all);

        scoring.pass(assetId);

        var expected = new ArrayList<Double>();
        for (double s : checkPath(first)) expected.add(s);
        for (double s : checkPath(second)) expected.add(s);
        var stored = data.scores(assetId);
        assertThat(stored).hasSize(24);
        for (int i = 0; i < 24; i++) {
            assertEquals(expected.get(i), stored.get(i).score(), PARITY, "sample " + i);
        }
    }

    @Test
    void aLateSampleIsScoredWithTheWindowAsItStandsAndNeighboursAreNotRescored() {
        var all = run(0, 12);
        var late = all.get(5);
        var early = new ArrayList<>(all);
        early.remove(5);
        store(early);
        scoring.pass(assetId);
        var before = data.scores(assetId);

        data.sample(estateId, assetId, deviceId, late);
        assertThat(scoring.pass(assetId)).isEqualTo(1);

        var after = data.scores(assetId);
        assertThat(after).hasSize(12);
        // The late sample's window is the 5 samples before it, all stored.
        double expected = checkPath(all.subList(0, 6))[5];
        assertEquals(expected, after.get(5).score(), PARITY);
        var neighbours = new ArrayList<>(after);
        neighbours.remove(5);
        assertThat(neighbours).isEqualTo(before);
    }

    @Test
    void aPassScoresAtMost3600OldestFirstAndThenTheRest() {
        int total = AnomalyModel.MAX_READINGS + 5;
        var readings = run(0, total);
        var rows = new ArrayList<org.jooq.Query>();
        for (var r : readings) {
            for (var metric : AnomalyTestData.METRICS) {
                rows.add(db.query(
                        "insert into \"DeviceReading\" (id, \"deviceId\", \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, ?, ?, ?::timestamptz, now())",
                        UUID.randomUUID(),
                        deviceId,
                        estateId,
                        assetId,
                        metric,
                        java.math.BigDecimal.valueOf(r.pressure()),
                        java.time.OffsetDateTime.ofInstant(r.timestamp(), java.time.ZoneOffset.UTC)));
            }
        }
        db.batch(rows).execute();

        assertThat(scoring.pass(assetId)).isEqualTo(AnomalyModel.MAX_READINGS);
        var first = data.scores(assetId);
        assertThat(first.getLast().measuredAt()).isEqualTo(t(AnomalyModel.MAX_READINGS - 1));

        assertThat(scoring.pass(assetId)).isEqualTo(5);
        assertThat(scoring.pass(assetId)).isZero();
        var stored = data.scores(assetId);
        assertThat(stored).hasSize(total);
        // The window carries over between passes: sample 3600 sees the 9 before it.
        double expected = checkPath(readings.subList(AnomalyModel.MAX_READINGS - 9, AnomalyModel.MAX_READINGS + 1))[9];
        assertEquals(expected, stored.get(AnomalyModel.MAX_READINGS).score(), PARITY);
    }

    @Test
    void aModelFailureStoresNothingAndTheNextPassScoresTheSamples() {
        store(run(0, 12));
        doThrow(new MlUnavailableException("down", null))
                .doCallRealMethod()
                .when(scorer)
                .scores(any());

        assertThatThrownBy(() -> scoring.pass(assetId)).isInstanceOf(MlUnavailableException.class);
        assertThat(data.scores(assetId)).isEmpty();

        assertThat(scoring.pass(assetId)).isEqualTo(12);
    }

    @Test
    void passesForOneAssetDoNotRunConcurrently() throws Exception {
        store(run(0, 12));
        var inside = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        doAnswer(invocation -> {
                    calls.incrementAndGet();
                    inside.countDown();
                    release.await(10, TimeUnit.SECONDS);
                    return invocation.callRealMethod();
                })
                .when(scorer)
                .scores(any());

        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> scoring.pass(assetId));
            assertThat(inside.await(10, TimeUnit.SECONDS)).isTrue();
            var b = pool.submit(() -> scoring.pass(assetId));
            // B must wait for A's lock: it never reaches the model while A holds it.
            Thread.sleep(500);
            assertThat(calls.get()).isEqualTo(1);
            release.countDown();
            assertThat(a.get(10, TimeUnit.SECONDS) + b.get(10, TimeUnit.SECONDS))
                    .isEqualTo(12);
        }
        assertThat(data.scores(assetId)).hasSize(12);
    }

    @Test
    void passesForDifferentAssetsCanRunConcurrently() throws Exception {
        var otherAsset = new DeviceTestData(db).asset(estateId, locationId);
        var otherDevice = new DeviceTestData(db).device(estateId, locationId, otherAsset, null);
        store(run(0, 3));
        for (var r : run(0, 3)) {
            data.sample(estateId, otherAsset, otherDevice, r);
        }
        var both = new CountDownLatch(2);
        doAnswer(invocation -> {
                    both.countDown();
                    assertThat(both.await(10, TimeUnit.SECONDS)).isTrue();
                    return invocation.callRealMethod();
                })
                .when(scorer)
                .scores(any());

        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> scoring.pass(assetId));
            var b = pool.submit(() -> scoring.pass(otherAsset));
            assertThat(a.get(15, TimeUnit.SECONDS) + b.get(15, TimeUnit.SECONDS))
                    .isEqualTo(6);
        }
    }

    @Test
    void onlyAnActivePumpInAnActiveEstateIsScored() {
        var devices = new DeviceTestData(db);
        var notPump = devices.asset(estateId, locationId);
        db.execute("update \"Asset\" set category = 'LIFT' where id = ?", notPump);
        var retired = devices.asset(estateId, locationId);
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", retired);
        var inactiveIds = devices.estateWithAsset("owner");
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", inactiveIds[0]);

        for (var asset : List.of(notPump, retired)) {
            var device = devices.device(estateId, locationId, asset, null);
            for (var r : run(0, 3)) data.sample(estateId, asset, device, r);
            assertThat(scoring.pass(asset)).isZero();
            assertThat(data.scores(asset)).isEmpty();
        }
        var device = devices.device(inactiveIds[0], inactiveIds[1], inactiveIds[2], null);
        for (var r : run(0, 3)) data.sample(inactiveIds[0], inactiveIds[2], device, r);
        assertThat(scoring.pass(inactiveIds[2])).isZero();
        assertThat(data.scores(inactiveIds[2])).isEmpty();
    }
}
