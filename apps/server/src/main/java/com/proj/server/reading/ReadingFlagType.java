package com.proj.server.reading;

/**
 * Why a stored reading is flagged. GAP, DUPLICATE_TIMESTAMP and OUT_OF_RANGE are suspect data (spec suspect-readings);
 * ANOMALY is a model finding (spec streaming-anomaly-detection).
 */
public enum ReadingFlagType {
    GAP,
    DUPLICATE_TIMESTAMP,
    OUT_OF_RANGE,
    ANOMALY
}
