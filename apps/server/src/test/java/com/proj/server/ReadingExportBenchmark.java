package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
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
            db.execute("update \"Asset\" set name=repeat('QA synthetic pump ',8) where \"estateId\"=?", estate[0]);
            seed(estate[0], estate[1], estate[2], data.device(estate[0], estate[1], estate[2], null), total / 2);
            seed(estate[0], estate[1], second, data.device(estate[0], estate[1], second, null), total - total / 2);
            seed(foreign[0], foreign[1], foreign[2], data.device(foreign[0], foreign[1], foreign[2], null), 10000);
            db.execute("analyze \"DeviceReading\"");
            db.execute("analyze \"ManualReading\"");
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
            long suspect = db.fetchOne(
                            "select count(*) from \"ManualReading\" where \"estateId\"=? and value>150", estate[0])
                    .get(0, Long.class);
            measure(estate[0], "?flag=OUT_OF_RANGE", suspect, false);
        } finally {
            for (var id : estates) {
                for (var table : List.of("DeviceReading", "ManualReading", "Device", "Asset", "Location"))
                    db.execute("delete from \"" + table + "\" where \"estateId\"=?", id);
                db.execute("delete from \"Estate\" where id=?", id);
            }
        }
    }

    private void seed(UUID estate, UUID location, UUID asset, UUID device, int total) {
        int sensors = total * 7 / 10;
        db.execute(
                "insert into \"DeviceReading\" (id,\"estateId\",\"assetId\",\"deviceId\",metric,value,\"measuredAt\",\"receivedAt\") select gen_random_uuid(),?,?,?,'TEMPERATURE',20+(n%3),'2026-01-01'::timestamptz+n*interval '60 seconds',now() from generate_series(1,?) n",
                estate, asset, device, sensors);
        db.execute(
                "insert into \"ManualReading\" (id,\"estateId\",\"assetId\",metric,value,\"measuredAt\",\"recordedAt\",\"recordedByUserId\",\"recordedByName\",\"submissionId\") select gen_random_uuid(),?,?,'TEMPERATURE',case when n%11=0 then 151 else 23 end,'2026-01-01'::timestamptz+n*interval '63 seconds',now(),'benchmark-recorder','QA technician',gen_random_uuid() from generate_series(1,?) n",
                estate, asset, total - sensors);
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
