package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Opt-in workload; its name deliberately excludes it from normal Surefire *Tests discovery. */
class ReadingImportBenchmark extends ReadingImportMultipartIntegrationTests {
    @ParameterizedTest
    @ValueSource(ints = {43_200, 100_000})
    void aMonthAndTheMaximumRecordWorkloadImportReportAndRollbackWithinTheBudget(int records) throws Exception {
        var file = new StringBuilder(HEADER);
        var start = Instant.parse("2025-09-01T00:00:00Z");
        int invalid = 0;
        int duplicate = 0;
        for (int i = 0; i < records; i++) {
            if (i % 100 == 99) {
                file.append(
                        row("not-a-number", start.plus(i, ChronoUnit.MINUTES).toString()));
                invalid++;
            } else if (i % 100 == 98) {
                file.append(row("21", start.plus(i - 1, ChronoUnit.MINUTES).toString()));
                duplicate++;
            } else file.append(row("21", start.plus(i, ChronoUnit.MINUTES).toString()));
        }
        var started = Instant.now();
        var response = send(file.toString().getBytes(StandardCharsets.UTF_8), "month.csv", "text/csv");
        assertThat(response.statusCode()).isEqualTo(201);
        var batch = JSON.readTree(response.body());
        counts(batch, records, records - invalid - duplicate, duplicate, invalid, 0);
        assertThat(Duration.between(started, Instant.now())).isLessThan(Duration.ofSeconds(120));
        assertThat(rows(batch).path("totalItems").asInt()).isEqualTo(records);
        assertThat(list().path("totalItems").asInt()).isEqualTo(records - invalid - duplicate);
        started = Instant.now();
        revert(batch, "manager", "Benchmark cleanup").andExpect(status().isOk());
        assertThat(Duration.between(started, Instant.now())).isLessThan(Duration.ofSeconds(120));
        assertThat(list().path("totalItems").asInt()).isZero();
        assertThat(rows(batch).path("totalItems").asInt()).isEqualTo(records);
    }
}
