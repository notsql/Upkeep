package com.proj.server.flatline;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeMap;

/** Evaluates one device/metric series without database, network or wall-clock access. */
public final class FlatlineDetector {
    /** Input values have already been normalized by ingestion; manual values are ignored. */
    public record Reading(Instant measuredAt, BigDecimal value, boolean sensorOrigin) {
        public Reading {
            Objects.requireNonNull(measuredAt, "measuredAt");
            Objects.requireNonNull(value, "value");
        }
    }

    /** The caller supplies the continuity limit; no reporting-interval multiplier is assumed. */
    public record Policy(Duration threshold, BigDecimal tolerance, Duration maximumGap) {
        public Policy {
            Objects.requireNonNull(threshold, "threshold");
            Objects.requireNonNull(tolerance, "tolerance");
            Objects.requireNonNull(maximumGap, "maximumGap");
            if (threshold.compareTo(Duration.ofMinutes(1)) < 0
                    || threshold.getSeconds() % 60 != 0
                    || threshold.getNano() != 0) {
                throw new IllegalArgumentException("Flatline duration must be a positive whole number of minutes.");
            }
            if (tolerance.signum() < 0) {
                throw new IllegalArgumentException("Flatline tolerance must not be negative.");
            }
            if (maximumGap.isZero() || maximumGap.isNegative()) {
                throw new IllegalArgumentException("Maximum reading gap must be positive.");
            }
        }
    }

    public record Run(
            Instant unchangedSince,
            Instant lastReadingAt,
            BigDecimal latestValue,
            BigDecimal minimumValue,
            BigDecimal maximumValue) {
        public Duration observedDuration() {
            return Duration.between(unchangedSince, lastReadingAt);
        }
    }

    /**
     * The caller scopes readings to one device/metric. A pause expiry remains a history cutoff after it
     * elapses. No result means only that no eligible current run qualifies, not that the sensor is healthy.
     */
    public Optional<Run> detect(
            List<Reading> readings, Policy policy, Instant checkedAt, Optional<Instant> pauseUntil) {
        Objects.requireNonNull(readings, "readings");
        Objects.requireNonNull(policy, "policy");
        Objects.requireNonNull(checkedAt, "checkedAt");
        Objects.requireNonNull(pauseUntil, "pauseUntil");
        if (pauseUntil.isPresent() && checkedAt.isBefore(pauseUntil.get())) {
            return Optional.empty();
        }

        var values = new TreeMap<Instant, BigDecimal>();
        for (Reading reading : readings) {
            if (!reading.sensorOrigin()
                    || reading.measuredAt().isAfter(checkedAt)
                    || (pauseUntil.isPresent() && reading.measuredAt().isBefore(pauseUntil.get()))) {
                continue;
            }
            BigDecimal previous = values.putIfAbsent(reading.measuredAt(), reading.value());
            if (previous != null && previous.compareTo(reading.value()) != 0) {
                throw new IllegalArgumentException("Conflicting sensor values at " + reading.measuredAt() + ".");
            }
        }

        Run run = null;
        int runSize = 0;
        for (var measurement : values.entrySet()) {
            Instant measuredAt = measurement.getKey();
            BigDecimal value = measurement.getValue();
            if (run == null) {
                run = new Run(measuredAt, measuredAt, value, value, value);
                runSize = 1;
                continue;
            }

            BigDecimal minimum = run.minimumValue().min(value);
            BigDecimal maximum = run.maximumValue().max(value);
            boolean gapBreaksRun =
                    Duration.between(run.lastReadingAt(), measuredAt).compareTo(policy.maximumGap()) > 0;
            boolean rangeBreaksRun = maximum.subtract(minimum).compareTo(policy.tolerance()) > 0;
            if (gapBreaksRun || rangeBreaksRun) {
                run = new Run(measuredAt, measuredAt, value, value, value);
                runSize = 1;
                continue;
            }

            run = new Run(run.unchangedSince(), measuredAt, value, minimum, maximum);
            runSize++;
        }

        if (run == null || runSize < 2 || run.observedDuration().compareTo(policy.threshold()) < 0) {
            return Optional.empty();
        }
        return Optional.of(run);
    }
}
