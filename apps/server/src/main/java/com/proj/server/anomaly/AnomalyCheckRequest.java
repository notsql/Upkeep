package com.proj.server.anomaly;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/** A batch of pump readings to score (failure-risk spec, Anomaly detection). */
@Schema(requiredProperties = {"readings"})
public record AnomalyCheckRequest(
        @Schema(description = "10 to 3,600 readings, at most 2 seconds apart once sorted by timestamp")
        List<Reading> readings) {

    /** One reading in platform units. Boxed so a missing value can be told apart from zero. */
    @Schema(requiredProperties = {"timestamp", "vibrationAcceleration", "pressure", "temperature", "flowRate", "power"})
    public record Reading(
            Instant timestamp,
            @Schema(description = "g (RMS)") Double vibrationAcceleration,
            @Schema(description = "bar") Double pressure,
            @Schema(description = "°C") Double temperature,
            @Schema(description = "L/min") Double flowRate,
            @Schema(description = "kW") Double power) {}
}
