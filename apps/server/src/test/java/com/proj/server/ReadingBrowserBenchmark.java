package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Arrays;
import java.util.UUID;
import org.jooq.DSLContext;
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
        db.execute("analyze \"DeviceReading\"");
        db.execute("set local statement_timeout='20s'");
        boolean legacy = Boolean.getBoolean("readings.benchmark.legacy");
        String base = "/estates/" + ids[0] + (legacy ? "/assets/" + ids[2] : "") + "/readings";
        String month = "?metric=TEMPERATURE&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z"
                + (legacy ? "" : "&assetId=" + ids[2]);
        System.out.printf(
                "ID60 benchmark: %s; %s; Java %s; 43,200 readings per device, 129,600 total%n",
                legacy ? "legacy" : "estate browser", db.dialect(), System.getProperty("java.version"));
        measure("selected-first", base + month, 43200);
        measure("selected-deep", base + month + "&page=800", 43200);
        measure("suspect-first", base + month + "&flag=OUT_OF_RANGE", 43200);
        measure("suspect-deep", base + month + "&flag=OUT_OF_RANGE&page=800", 43200);
        if (!legacy) measure("all-assets-first", base + "?metric=TEMPERATURE", 86400);
        // Capture an index plan separately from HTTP timing; the actual flagged SQL is inspected
        // when timings show a bottleneck, without printing credentials or business data.
        db.fetch(
                        "explain (analyze, buffers) select id from \"DeviceReading\" where \"assetId\"=? and metric='TEMPERATURE' and \"measuredAt\">='2026-09-01' and \"measuredAt\"<'2026-10-01' order by \"measuredAt\" desc,id desc limit 50",
                        ids[2])
                .forEach(row -> System.out.println("ID60 plan: " + row.get(0)));
    }

    void seed(UUID[] ids, UUID device) {
        db.execute(
                "insert into \"DeviceReading\" (id,\"estateId\",\"assetId\",\"deviceId\",metric,value,\"measuredAt\",\"receivedAt\") select gen_random_uuid(),?,?,?,'TEMPERATURE',151,'2026-09-01T00:00:00Z'::timestamptz + n*interval '1 minute',now() from generate_series(0,43199) n",
                ids[0],
                ids[2],
                device);
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
