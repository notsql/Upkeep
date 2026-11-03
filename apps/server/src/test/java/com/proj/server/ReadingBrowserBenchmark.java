package com.proj.server;

import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
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
import org.springframework.transaction.annotation.Transactional;

/**
 * Explicitly run with -Dtest=ReadingBrowserBenchmark (not part of Surefire's ordinary *Tests pattern).
 * Set -Dreadings.benchmark.legacy=true to measure ID-67 before ID-60 exists. Reports timing, never
 * asserts a machine-dependent wall-clock limit. Every fixture is rolled back in a disposable database.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ReadingBrowserBenchmark {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @Test
    void measuresThirtyDaysIncludingCountsFlagsAndDeepPagination() throws Exception {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("benchmark-owner");
        var device = data.device(ids[0], ids[1], ids[2], null);
        seed(ids, device);
        var other = data.estateWithAsset("another-owner");
        seed(other, data.device(other[0], other[1], other[2], null));
        var secondAsset = data.asset(ids[0], ids[1]);
        seed(new UUID[] {ids[0], ids[1], secondAsset}, data.device(ids[0], ids[1], secondAsset, null));
        db.setLocal("statement_timeout", val("20s")).execute();
        boolean legacy = Boolean.getBoolean("readings.benchmark.legacy");
        String base = "/estates/" + ids[0] + (legacy ? "/assets/" + ids[2] : "") + "/readings";
        String month = "?metric=TEMPERATURE&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z"
                + (legacy ? "" : "&assetId=" + ids[2]);
        System.out.printf(
                "ID60 benchmark: %s; %s; Java %s; 43,200 readings per device, 129,600 total%n",
                legacy ? "legacy" : "estate browser", db.dialect(), System.getProperty("java.version"));
        int manualRows = Boolean.getBoolean("readings.benchmark.manual") ? 4320 : 0;
        measure("selected-first", base + month, 43200 + manualRows);
        measure("selected-deep", base + month + "&page=800", 43200 + manualRows);
        measure("suspect-first", base + month + "&flag=OUT_OF_RANGE", 43200 + manualRows);
        measure("suspect-deep", base + month + "&flag=OUT_OF_RANGE&page=800", 43200 + manualRows);
        if (!legacy) measure("all-assets-first", base + "?metric=TEMPERATURE", 86400 + manualRows * 2);
        // Capture an index plan separately from HTTP timing; the actual flagged SQL is inspected
        // when timings show a bottleneck, without printing credentials or business data.
        var query = db.select(DEVICEREADING.ID)
                .from(DEVICEREADING)
                .where(
                        DEVICEREADING.ASSETID.eq(ids[2]),
                        DEVICEREADING.METRIC.eq("TEMPERATURE"),
                        DEVICEREADING.MEASUREDAT.ge(OffsetDateTime.parse("2026-09-01T00:00:00Z")),
                        DEVICEREADING.MEASUREDAT.lt(OffsetDateTime.parse("2026-10-01T00:00:00Z")))
                .orderBy(DEVICEREADING.MEASUREDAT.desc(), DEVICEREADING.ID.desc())
                .limit(50);
        System.out.println("ID60 plan: " + db.explain(query).plan());
    }

    void seed(UUID[] ids, UUID device) {
        var series = generateSeries(0, 43199);
        var start = val(OffsetDateTime.parse("2026-09-01T00:00:00Z"));
        var minute = val(DayToSecond.valueOf(Duration.ofMinutes(1)));
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
                                inline("TEMPERATURE"),
                                inline(BigDecimal.valueOf(151)),
                                start.add(minute.mul(series.field(0, Integer.class))),
                                currentOffsetDateTime())
                        .from(series))
                .execute();
        if (Boolean.getBoolean("readings.benchmark.manual")) {
            var manualSeries = generateSeries(0, 4319);
            db.insertInto(MANUALREADING)
                    .columns(
                            MANUALREADING.ID,
                            MANUALREADING.ESTATEID,
                            MANUALREADING.ASSETID,
                            MANUALREADING.METRIC,
                            MANUALREADING.VALUE,
                            MANUALREADING.MEASUREDAT,
                            MANUALREADING.RECORDEDAT,
                            MANUALREADING.RECORDEDBYUSERID,
                            MANUALREADING.SUBMISSIONID)
                    .select(select(
                                    uuid(),
                                    val(ids[0]),
                                    val(ids[2]),
                                    inline("TEMPERATURE"),
                                    inline(BigDecimal.valueOf(151)),
                                    start.add(minute.mul(
                                            manualSeries.field(0, Integer.class).mul(10))),
                                    currentOffsetDateTime(),
                                    inline("benchmark-owner"),
                                    uuid())
                            .from(manualSeries))
                    .execute();
        }
    }

    void measure(String label, String url, int total) throws Exception {
        for (int i = 0; i < 2; i++) request(url, total);
        double[] milliseconds = new double[10];
        for (int i = 0; i < milliseconds.length; i++) {
            long start = System.nanoTime();
            request(url, total);
            milliseconds[i] = (System.nanoTime() - start) / 1_000_000.0;
        }
        Arrays.sort(milliseconds);
        System.out.printf(
                "ID60 benchmark %s: n=10 median=%.1fms p95=%.1fms max=%.1fms%n",
                label, milliseconds[4], milliseconds[9], milliseconds[9]);
    }

    void request(String url, int total) throws Exception {
        mvc.perform(get(url).with(jwt().jwt(j -> j.subject("benchmark-owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(total))
                .andExpect(jsonPath("$.items.length()").value(50));
    }
}
