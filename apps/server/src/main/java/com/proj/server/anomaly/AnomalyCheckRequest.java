package com.proj.server.anomaly;

import java.time.Instant;
import java.util.List;

/** A batch of pump readings to score (failure-risk spec, Anomaly detection). */
public record AnomalyCheckRequest(List<Reading> readings) {

    /** One reading in platform units. Boxed so a missing value can be told apart from zero. */
    public record Reading(
            Instant timestamp,
            Double vibrationAcceleration,
            Double pressure,
            Double temperature,
            Double flowRate,
            Double power) {}
}
