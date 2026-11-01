package com.proj.server.inspectionlist;

/** Why a check is due: a failure-risk prediction, a service interval, or no inspection yet. */
public enum DueBasis {
    PREDICTION,
    INTERVAL,
    NEVER_INSPECTED
}
