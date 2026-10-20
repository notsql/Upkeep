package com.proj.server.reading;

/** Why a stored reading looks suspect (spec suspect-readings, "Flags"). */
public enum ReadingFlagType {
    GAP,
    DUPLICATE_TIMESTAMP,
    OUT_OF_RANGE
}
