package com.proj.server.flatline;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;

@Schema(
        requiredProperties = {
            "unchangedSince",
            "lastReadingAt",
            "observedDurationSeconds",
            "minimumValue",
            "maximumValue",
            "latestValue"
        })
public record FlatlineEvidenceResponse(
        Instant unchangedSince,
        Instant lastReadingAt,
        long observedDurationSeconds,
        BigDecimal minimumValue,
        BigDecimal maximumValue,
        BigDecimal latestValue) {}
