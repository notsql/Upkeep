package com.proj.server.inspectionlist;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.proj.server.category.IntervalUnit;
import com.proj.server.category.ServiceInterval;
import com.proj.server.risk.RecommendedTimeframe;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Due-date rules of the monthly inspection list (ID-84, spec monthly-inspection-list.md). */
class DueDatesTests {
    static final LocalDate TODAY = LocalDate.of(2026, 11, 10);
    static final LocalDate MONTH = LocalDate.of(2026, 11, 1);
    static final ServiceInterval SIX_MONTHS = new ServiceInterval(6, IntervalUnit.MONTH);

    @Test
    void neverInspectedWithoutAnInstallationDateIsDueAtTheStartOfTheMonth() {
        var due = DueDates.due(null, null, SIX_MONTHS, null, TODAY, MONTH);
        assertEquals(new DueDates.Due(MONTH, DueBasis.NEVER_INSPECTED), due);
    }

    @Test
    void neverInspectedWinsEvenWithoutAnInterval() {
        var due = DueDates.due(null, null, null, null, TODAY, MONTH);
        assertEquals(new DueDates.Due(MONTH, DueBasis.NEVER_INSPECTED), due);
    }

    @ParameterizedTest
    @CsvSource({"14,DAY,2026-05-15", "6,MONTH,2026-11-01", "1,YEAR,2027-05-01"})
    void theIntervalIsAddedToTheLastInspectionInItsUnit(int value, IntervalUnit unit, LocalDate expected) {
        var due = DueDates.due(LocalDate.of(2026, 5, 1), null, new ServiceInterval(value, unit), null, TODAY, MONTH);
        assertEquals(new DueDates.Due(expected, DueBasis.INTERVAL), due);
    }

    @Test
    void monthEndsAreKeptByCalendarArithmetic() {
        var due = DueDates.due(
                LocalDate.of(2026, 8, 31), null, new ServiceInterval(1, IntervalUnit.MONTH), null, TODAY, MONTH);
        assertEquals(new DueDates.Due(LocalDate.of(2026, 9, 30), DueBasis.INTERVAL), due);
    }

    @Test
    void theInstallationDateStandsInForAMissingInspection() {
        var due = DueDates.due(null, LocalDate.of(2026, 2, 1), SIX_MONTHS, null, TODAY, MONTH);
        assertEquals(new DueDates.Due(LocalDate.of(2026, 8, 1), DueBasis.INTERVAL), due);
    }

    @Test
    void theLastInspectionBeatsTheInstallationDate() {
        var due = DueDates.due(LocalDate.of(2026, 9, 1), LocalDate.of(2020, 1, 1), SIX_MONTHS, null, TODAY, MONTH);
        assertEquals(new DueDates.Due(LocalDate.of(2027, 3, 1), DueBasis.INTERVAL), due);
    }

    @Test
    void withoutAnIntervalOrPredictionAnInspectedAssetIsNotScheduled() {
        assertNull(DueDates.due(LocalDate.of(2026, 9, 1), null, null, null, TODAY, MONTH));
        assertNull(
                DueDates.due(LocalDate.of(2026, 9, 1), null, null, RecommendedTimeframe.BEYOND_90_DAYS, TODAY, MONTH));
    }

    @ParameterizedTest
    @CsvSource({"WITHIN_30_DAYS,2026-11-10", "WITHIN_60_DAYS,2026-12-10", "WITHIN_90_DAYS,2027-01-09"})
    void aPredictionIsDueAtTheStartOfItsRecommendedWindow(RecommendedTimeframe timeframe, LocalDate expected) {
        var due = DueDates.due(LocalDate.of(2026, 9, 1), null, null, timeframe, TODAY, MONTH);
        assertEquals(new DueDates.Due(expected, DueBasis.PREDICTION), due);
    }

    @Test
    void theEarlierOfPredictionAndIntervalWins() {
        var predicted = DueDates.due(
                LocalDate.of(2026, 9, 1), null, SIX_MONTHS, RecommendedTimeframe.WITHIN_30_DAYS, TODAY, MONTH);
        assertEquals(new DueDates.Due(TODAY, DueBasis.PREDICTION), predicted);
        var interval = DueDates.due(
                LocalDate.of(2026, 1, 1), null, SIX_MONTHS, RecommendedTimeframe.WITHIN_90_DAYS, TODAY, MONTH);
        assertEquals(new DueDates.Due(LocalDate.of(2026, 7, 1), DueBasis.INTERVAL), interval);
    }

    @Test
    void aTieGoesToTheInterval() {
        var due = DueDates.due(
                LocalDate.of(2026, 5, 10), null, SIX_MONTHS, RecommendedTimeframe.WITHIN_30_DAYS, TODAY, MONTH);
        assertEquals(new DueDates.Due(TODAY, DueBasis.INTERVAL), due);
    }

    @Test
    void aBeyondNinetyDaysPredictionLeavesTheInterval() {
        var due = DueDates.due(
                LocalDate.of(2026, 5, 1), null, SIX_MONTHS, RecommendedTimeframe.BEYOND_90_DAYS, TODAY, MONTH);
        assertEquals(new DueDates.Due(LocalDate.of(2026, 11, 1), DueBasis.INTERVAL), due);
    }
}
