package com.proj.server;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static org.assertj.core.api.Assertions.assertThat;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.jooq.impl.DSL.generateSeries;
import static org.jooq.impl.DSL.inline;
import static org.jooq.impl.DSL.select;
import static org.jooq.impl.DSL.uuid;
import static org.jooq.impl.DSL.val;
import static org.jooq.impl.DSL.when;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.types.DayToSecond;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/** Opt-in real HTTP benchmark: -Dtest=ReadingExportBenchmark -Dreadings.export.rows=100000 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "logging.level.org.jooq=INFO",
            "logging.level.org.springframework=INFO"
        })
@Import(TestcontainersConfiguration.class)
class ReadingExportBenchmark {
    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @LocalServerPort
    int port;

    @Autowired
    @org.springframework.beans.factory.annotation.Qualifier("readingExportExecutor")
    org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor executor;

    @Autowired
    javax.sql.DataSource source;

    @Test
    void exportsMixedDataOverRealHttpWithBoundedClientMemory() throws Exception {
        var data = new DeviceTestData(db);
        var estate = data.estateWithAsset("csv-benchmark");
        var second = data.asset(estate[0], estate[1]);
        var foreign = data.estateWithAsset("other-benchmark");
        List<UUID> estates = List.of(estate[0], foreign[0]);
        int total = Integer.getInteger("readings.export.rows", 100000);
        when(decoder.decode("benchmark-token"))
                .thenReturn(Jwt.withTokenValue("benchmark-token")
                        .header("alg", "RS256")
                        .subject("csv-benchmark")
                        .build());
        try {
            db.update(ASSET)
                    .set(ASSET.NAME, "QA synthetic pump ".repeat(8))
                    .where(ASSET.ESTATEID.eq(estate[0]))
                    .execute();
            seed(estate[0], estate[2], data.device(estate[0], estate[1], estate[2], null), total / 2);
            seed(estate[0], second, data.device(estate[0], estate[1], second, null), total - total / 2);
            seed(foreign[0], foreign[2], data.device(foreign[0], foreign[1], foreign[2], null), 10000);
            measure(estate[0], "", total, true);
            try (var client = HttpClient.newHttpClient()) {
                var cancel = HttpRequest.newBuilder(
                                URI.create("http://127.0.0.1:" + port + "/estates/" + estate[0] + "/readings/export"))
                        .header("Authorization", "Bearer benchmark-token")
                        .build();
                try (var body = client.send(cancel, HttpResponse.BodyHandlers.ofInputStream())
                        .body()) {
                    body.readNBytes(1024);
                }
                org.awaitility.Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
                    assertThat(executor.getActiveCount()).isZero();
                    assertThat(source.unwrap(com.zaxxer.hikari.HikariDataSource.class)
                                    .getHikariPoolMXBean()
                                    .getActiveConnections())
                            .isZero();
                });
                System.out.println("ID61 HTTP cancellation: export worker and database connection released");
            }
            long suspect = db.fetchCount(
                    MANUALREADING,
                    MANUALREADING.ESTATEID.eq(estate[0]).and(MANUALREADING.VALUE.gt(BigDecimal.valueOf(150))));
            measure(estate[0], "?flag=OUT_OF_RANGE", suspect, false);
        } finally {
            for (var id : estates) {
                db.deleteFrom(DEVICEREADING)
                        .where(DEVICEREADING.ESTATEID.eq(id))
                        .execute();
                db.deleteFrom(MANUALREADING)
                        .where(MANUALREADING.ESTATEID.eq(id))
                        .execute();
                db.deleteFrom(DEVICE).where(DEVICE.ESTATEID.eq(id)).execute();
                db.deleteFrom(ASSET).where(ASSET.ESTATEID.eq(id)).execute();
                db.deleteFrom(LOCATION).where(LOCATION.ESTATEID.eq(id)).execute();
                db.deleteFrom(ESTATE).where(ESTATE.ID.eq(id)).execute();
            }
        }
    }

    private void seed(UUID estate, UUID asset, UUID device, int total) {
        int sensors = total * 7 / 10;
        var series = generateSeries(1, sensors);
        var n = series.field(0, Integer.class);
        var start = val(OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        var second = val(DayToSecond.valueOf(Duration.ofSeconds(1)));
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
                                n.mod(3).add(20).cast(BigDecimal.class),
                                start.add(second.mul(n.mul(60))),
                                currentOffsetDateTime())
                        .from(series))
                .execute();
        var manualSeries = generateSeries(1, total - sensors);
        var manualN = manualSeries.field(0, Integer.class);
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
                        MANUALREADING.RECORDEDBYNAME,
                        MANUALREADING.SUBMISSIONID)
                .select(select(
                                uuid(),
                                val(estate),
                                val(asset),
                                inline("TEMPERATURE"),
                                when(manualN.mod(11).eq(0), BigDecimal.valueOf(151))
                                        .otherwise(BigDecimal.valueOf(23)),
                                start.add(second.mul(manualN.mul(63))),
                                currentOffsetDateTime(),
                                inline("benchmark-recorder"),
                                inline("QA technician"),
                                uuid())
                        .from(manualSeries))
                .execute();
    }

    private void measure(UUID estate, String query, long expected, boolean large) throws Exception {
        try (var client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(5))
                .build()) {
            var request = HttpRequest.newBuilder(
                            URI.create("http://127.0.0.1:" + port + "/estates/" + estate + "/readings/export" + query))
                    .header("Authorization", "Bearer benchmark-token")
                    .timeout(Duration.ofSeconds(120))
                    .build();
            var start = System.nanoTime();
            var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("X-Export-Row-Count")).hasValue(Long.toString(expected));
            assertThat(response.headers().firstValue("Transfer-Encoding")).hasValue("chunked");
            long bytes = 0, lines = 0;
            try (var stream = response.body()) {
                byte[] buffer = new byte[32768];
                for (int count; (count = stream.read(buffer)) != -1; ) {
                    bytes += count;
                    for (int i = 0; i < count; i++) if (buffer[i] == '\n') lines++;
                }
            }
            double elapsed = (System.nanoTime() - start) / 1e9;
            assertThat(lines).isEqualTo(expected + 1);
            assertThat(elapsed).isLessThan(120.0);
            if (large) assertThat(bytes).isGreaterThan(32L * 1024 * 1024);
            System.out.printf(
                    "ID61 HTTP export: rows=%d bytes=%d seconds=%.3f query=%s%n", expected, bytes, elapsed, query);
        }
    }
}
