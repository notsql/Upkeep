package com.proj.server.inspectionlist;

/** Why a check is due: a prediction, a service interval, no inspection yet, or a manager sent crew. */
public enum DueBasis {
    PREDICTION,
    INTERVAL,
    NEVER_INSPECTED,
    REQUESTED
}
