package com.proj.server.reading;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ReadingImportParserTests {
    private static ReadingImportOptions options() {
        return new ReadingImportOptions(
                UUID.randomUUID(),
                "Vendor",
                ReadingImportPreset.VENDOR,
                "asset_id",
                Map.of("asset_id", "asset_id", "metric", "metric", "measured_at", "measured_at", "value", "value"));
    }

    @Test
    void headerFieldsAreBoundedEvenWhenNotMapped() {
        var csv = "asset_id,metric,measured_at,value," + "x".repeat(4097)
                + "\na,TEMPERATURE,2026-01-01T00:00:00Z,21,ignored\n";
        var error = assertThrows(
                ReadingException.class,
                () -> ReadingImportParser.parse(csv.getBytes(StandardCharsets.UTF_8), options()));
        assertThat(error.status().value()).isEqualTo(413);
    }

    @Test
    void unusedDataFieldsAreBoundedToo() {
        var csv = "asset_id,metric,measured_at,value,note\na,TEMPERATURE,2026-01-01T00:00:00Z,21," + "x".repeat(4097)
                + "\n";
        var error = assertThrows(
                ReadingException.class,
                () -> ReadingImportParser.parse(csv.getBytes(StandardCharsets.UTF_8), options()));
        assertThat(error.status().value()).isEqualTo(413);
    }

    @ParameterizedTest
    @ValueSource(strings = {"oversized field", "too many columns"})
    void blankRecordsCannotBypassStructuralLimits(String limit) {
        var blank = limit.equals("oversized field") ? " ".repeat(4097) : ",".repeat(128);
        var csv = "asset_id,metric,measured_at,value\n" + blank + "\na,TEMPERATURE,2026-01-01T00:00:00Z,21\n";
        var error = assertThrows(
                ReadingException.class,
                () -> ReadingImportParser.parse(csv.getBytes(StandardCharsets.UTF_8), options()));
        assertThat(error.status().value()).isEqualTo(413);
    }
}
