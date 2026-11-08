package com.proj.server.reading;

/** How one item of a telemetry batch was decided. */
public enum TelemetryItemStatus {
    CREATED,
    ALREADY_STORED,
    INVALID,
    CONFLICT
}
