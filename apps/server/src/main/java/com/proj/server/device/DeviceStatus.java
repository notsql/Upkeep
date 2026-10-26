package com.proj.server.device;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;

/** Derived on every read, never stored (decision 0027). */
public enum DeviceStatus {
    AWAITING_FIRST_READING,
    ONLINE,
    OFFLINE,
    DEACTIVATED;

    static final Duration MINIMUM_OFFLINE_THRESHOLD = Duration.ofMinutes(5);

    /** A deactivated device is {@code DEACTIVATED} whatever it last reported (ID-45). */
    public static DeviceStatus of(
            OffsetDateTime deactivatedAt, OffsetDateTime lastSeenAt, int reportingIntervalSeconds, Instant now) {
        return deactivatedAt != null ? DEACTIVATED : of(lastSeenAt, reportingIntervalSeconds, now);
    }

    /** Offline after 3 times the interval or 5 minutes of silence, whichever is longer. */
    public static DeviceStatus of(OffsetDateTime lastSeenAt, int reportingIntervalSeconds, Instant now) {
        if (lastSeenAt == null) {
            return AWAITING_FIRST_READING;
        }
        var threshold = Duration.ofSeconds(3L * reportingIntervalSeconds);
        if (threshold.compareTo(MINIMUM_OFFLINE_THRESHOLD) < 0) {
            threshold = MINIMUM_OFFLINE_THRESHOLD;
        }
        var silence = Duration.between(lastSeenAt.toInstant(), now);
        return silence.compareTo(threshold) > 0 ? OFFLINE : ONLINE;
    }
}
