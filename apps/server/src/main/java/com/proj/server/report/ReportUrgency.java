package com.proj.server.report;

public enum ReportUrgency {
    LOW(0),
    MEDIUM(1),
    HIGH(2),
    URGENT(3);

    private final int rank;

    ReportUrgency(int rank) {
        this.rank = rank;
    }

    public int rank() {
        return rank;
    }
}
