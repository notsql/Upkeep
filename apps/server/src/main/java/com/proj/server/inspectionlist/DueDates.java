package com.proj.server.inspectionlist;

import com.proj.server.category.ServiceInterval;
import com.proj.server.risk.RecommendedTimeframe;
import java.time.LocalDate;

/** When an eligible asset is next due for a check (ID-84, spec monthly-inspection-list.md). */
final class DueDates {
    record Due(LocalDate dueOn, DueBasis basis) {}

    private DueDates() {}

    /**
     * The due date counted from the last inspection (or installation), else the start of the month
     * when the asset has neither. The earlier of the interval and prediction wins, the interval on a
     * tie. Null when there is a last inspection but no interval or usable prediction.
     */
    static Due due(
            LocalDate lastInspected,
            LocalDate installedOn,
            ServiceInterval interval,
            RecommendedTimeframe timeframe,
            LocalDate today,
            LocalDate month) {
        var base = lastInspected != null ? lastInspected : installedOn;
        if (base == null) {
            return new Due(month, DueBasis.NEVER_INSPECTED);
        }
        var byInterval = interval == null ? null : plus(base, interval);
        var predicted = predicted(timeframe, today);
        if (byInterval == null && predicted == null) {
            return null;
        }
        if (predicted != null && (byInterval == null || predicted.isBefore(byInterval))) {
            return new Due(predicted, DueBasis.PREDICTION);
        }
        return new Due(byInterval, DueBasis.INTERVAL);
    }

    /** The start of the recommended window: now, in 30 days or in 60 days. */
    private static LocalDate predicted(RecommendedTimeframe timeframe, LocalDate today) {
        if (timeframe == null) {
            return null;
        }
        return switch (timeframe) {
            case WITHIN_30_DAYS -> today;
            case WITHIN_60_DAYS -> today.plusDays(30);
            case WITHIN_90_DAYS -> today.plusDays(60);
            case BEYOND_90_DAYS -> null;
        };
    }

    static LocalDate plus(LocalDate date, ServiceInterval interval) {
        return switch (interval.unit()) {
            case DAY -> date.plusDays(interval.value());
            case MONTH -> date.plusMonths(interval.value());
            case YEAR -> date.plusYears(interval.value());
        };
    }
}
