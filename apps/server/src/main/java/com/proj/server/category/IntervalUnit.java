package com.proj.server.category;

/** The unit of a service interval, with the largest value it allows (ten years in each unit). */
public enum IntervalUnit {
    DAY(3650),
    MONTH(120),
    YEAR(10);

    private final int max;

    IntervalUnit(int max) {
        this.max = max;
    }

    int max() {
        return max;
    }
}
