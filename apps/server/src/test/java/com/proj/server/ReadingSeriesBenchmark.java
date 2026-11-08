package com.proj.server;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
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
import java.util.Arrays;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.types.DayToSecond;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.transaction.annotation.Transactional;

/**
 * Explicitly run with -Dtest=ReadingSeriesBenchmark (not part of Surefire's ordinary *Tests pattern). Seeds 24 hours of
 * one pump at 1 Hz (432,000 device readings, 86,400 scores) and reports warm timings; targets (spec
 * asset-readings-charts) are p95 under 2 s for the 24 h series and under 200 ms for the grouped page; filtered grouped
 * pages (spec asset-readings-charts-refresh) under 200 ms with no flag and 500 ms for "Anomalous only". One sample in
 * 600 scores as an anomaly. Never asserts a machine-dependent limit. Rolled back.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReadingSeriesBenchmark {
    static final OffsetDateTime START = OffsetDateTime.parse("2026-11-06T12:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    String base;

    @Test
    void measuresADayOfOnePumpAtOneHertz() throws Exception {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("benchmark-owner");
        var device = data.device(ids[0], ids[1], ids[2], null);
        seed(ids, device);
        db.execute("analyze \"DeviceReading\"");
        db.execute("analyze \"AnomalyScore\"");
        base = "/estates/" + ids[0] + "/assets/" + ids[2] + "/readings";
        System.out.printf(
                "Series benchmark: %s; Java %s; 432,000 readings, 86,400 scores%n",
                db.dialect(), System.getProperty("java.version"));
        measure(
                "series-24h",
                "/series?from=2026-11-06T12:00:00Z&to=2026-11-07T12:00:00Z",
                jsonPath("$.metrics[0].points.length()").value(288));
        measure(
                "series-1min",
                "/series?from=2026-11-07T11:59:00Z&to=2026-11-07T12:00:00Z",
                jsonPath("$.metrics[0].points.length()").value(60));
        measure("grouped-latest", "/grouped", jsonPath("$.groups.length()").value(20));
        measure(
                "grouped-limit-100",
                "/grouped?limit=100",
                jsonPath("$.groups.length()").value(100));
        measure(
                "grouped-mid-day",
                "/grouped?before=2026-11-07T00:00:00Z",
                jsonPath("$.nextBefore").value("2026-11-06T23:59:40Z"));
        measure(
                "grouped-metric-temperature",
                "/grouped?limit=50&metric=TEMPERATURE",
                jsonPath("$.groups[0].metrics.length()").value(1));
        measure(
                "grouped-from-to",
                "/grouped?limit=50&from=2026-11-06T18:00:00Z&to=2026-11-07T00:00:00Z",
                jsonPath("$.nextBefore").value("2026-11-06T23:59:10Z"));
        measure(
                "grouped-flag-anomaly",
                "/grouped?limit=50&flag=ANOMALY",
                jsonPath("$.groups.length()").value(50));
        measure(
                "grouped-flag-anomaly-none-before",
                "/grouped?limit=50&flag=ANOMALY&before=2026-11-06T12:00:00Z",
                jsonPath("$.groups.length()").value(0));
        measure(
                "grouped-flag-suspect",
                "/grouped?limit=50&flag=GAP&flag=DUPLICATE_TIMESTAMP&flag=OUT_OF_RANGE",
                jsonPath("$.groups.length()").value(0));
    }

    void seed(UUID[] ids, UUID device) {
        var series = generateSeries(0, 86399);
        var second = val(DayToSecond.valueOf(Duration.ofSeconds(1)));
        var at = val(START).add(second.mul(series.field(0, Integer.class)));
        for (var metric : AnomalyTestData.METRICS) {
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
                                    val(ids[0]),
                                    val(ids[2]),
                                    val(device),
                                    inline(metric),
                                    inline(BigDecimal.ONE),
                                    at,
                                    currentOffsetDateTime())
                            .from(series))
                    .execute();
        }
        db.insertInto(ANOMALYSCORE)
                .columns(
                        ANOMALYSCORE.ID,
                        ANOMALYSCORE.ESTATEID,
                        ANOMALYSCORE.ASSETID,
                        ANOMALYSCORE.MEASUREDAT,
                        ANOMALYSCORE.SCORE,
                        ANOMALYSCORE.SCOREDAT)
                .select(select(uuid(), val(ids[0]), val(ids[2]), at, inline(0.2), currentOffsetDateTime())
                        .from(series))
                .execute();
        db.execute(
                "update \"AnomalyScore\" set score = 0.8 where extract(epoch from \"measuredAt\")::bigint % 600 = 0");
    }

    void measure(String label, String query, ResultMatcher expected) throws Exception {
        for (int i = 0; i < 2; i++) request(query, expected);
        double[] milliseconds = new double[20];
        for (int i = 0; i < milliseconds.length; i++) {
            long start = System.nanoTime();
            request(query, expected);
            milliseconds[i] = (System.nanoTime() - start) / 1_000_000.0;
        }
        Arrays.sort(milliseconds);
        System.out.printf(
                "Series benchmark %s: n=20 median=%.1fms p95=%.1fms max=%.1fms%n",
                label, milliseconds[9], milliseconds[18], milliseconds[19]);
    }

    void request(String query, ResultMatcher expected) throws Exception {
        mvc.perform(get(base + query).with(jwt().jwt(j -> j.subject("benchmark-owner"))))
                .andExpect(status().isOk())
                .andExpect(expected);
    }
}
