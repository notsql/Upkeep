package com.proj.server.flatline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class FlatlineDetectorTests {
    private static final Instant START = Instant.parse("2026-10-18T02:00:00Z");
    private static final FlatlineDetector.Policy EXACT =
            new FlatlineDetector.Policy(Duration.ofMinutes(2), BigDecimal.ZERO, Duration.ofMinutes(1));

    private final FlatlineDetector detector = new FlatlineDetector();

    @Test
    void flagsIdenticalReadingsExactlyAtTheDurationThreshold() {
        var readings = List.of(sensor(0, "3.000000"), sensor(60, "3.000000"), sensor(120, "3.000000"));

        var run = detector.detect(readings, EXACT, at(120), Optional.empty()).orElseThrow();

        assertEquals(START, run.unchangedSince());
        assertEquals(at(120), run.lastReadingAt());
        assertEquals(Duration.ofMinutes(2), run.observedDuration());
        assertEquals(new BigDecimal("3.000000"), run.latestValue());
        assertEquals(new BigDecimal("3.000000"), run.minimumValue());
        assertEquals(new BigDecimal("3.000000"), run.maximumValue());
    }

    @Test
    void doesNotFlagBeforeEnoughMeasurementTimeHasElapsed() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(119, "3"));

        assertTrue(detector.detect(readings, EXACT, at(119), Optional.empty()).isEmpty());
    }

    @Test
    void flagsBeyondTheDurationThreshold() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(121, "3"));

        var run = detector.detect(readings, EXACT, at(121), Optional.empty()).orElseThrow();

        assertEquals(Duration.ofSeconds(121), run.observedDuration());
    }

    @Test
    void silenceCannotCreateOrExtendAFlatline() {
        var shortRun = List.of(sensor(0, "3"), sensor(60, "3"));
        var longRun = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"));

        assertTrue(detector.detect(shortRun, EXACT, at(7200), Optional.empty()).isEmpty());
        var run = detector.detect(longRun, EXACT, at(7200), Optional.empty()).orElseThrow();
        assertEquals(at(120), run.lastReadingAt());
        assertEquals(Duration.ofMinutes(2), run.observedDuration());
    }

    @Test
    void emptyHistoriesAndSingleMeasurementsCannotEstablishAFlatline() {
        assertTrue(detector.detect(List.of(), EXACT, at(7200), Optional.empty()).isEmpty());
        assertTrue(detector.detect(List.of(sensor(0, "3")), EXACT, at(7200), Optional.empty())
                .isEmpty());
    }

    @Test
    void changedValueClearsTheOldWarning() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(180, "3.1"));

        assertTrue(detector.detect(readings, EXACT, at(180), Optional.empty()).isEmpty());
    }

    @Test
    void aNewUnchangedRunCanFlagAfterAChange() {
        var readings =
                List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3.1"), sensor(180, "3.1"), sensor(240, "3.1"));

        var run = detector.detect(readings, EXACT, at(240), Optional.empty()).orElseThrow();

        assertEquals(at(120), run.unchangedSince());
        assertEquals(new BigDecimal("3.1"), run.latestValue());
    }

    @Test
    void exactMatchingUsesNumericEqualityRatherThanDecimalScale() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3.0"), sensor(120, "3.000000"));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isPresent());
    }

    @Test
    void exactMatchingDetectsEvenASmallStoredValueChange() {
        var readings = List.of(sensor(0, "3.000000"), sensor(60, "3.000000"), sensor(120, "3.000001"));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void largeDecimalsAreNotCollapsedByFloatingPointConversion() {
        var readings = List.of(
                sensor(0, "999999999999.000001"),
                sensor(60, "999999999999.000001"),
                sensor(120, "999999999999.000002"));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void permitsFluctuationExactlyAtTheConfiguredTolerance() {
        var policy = new FlatlineDetector.Policy(Duration.ofMinutes(2), new BigDecimal("0.01"), Duration.ofMinutes(1));
        var readings = List.of(sensor(0, "3.00"), sensor(60, "3.01"), sensor(120, "3.005"));

        var run = detector.detect(readings, policy, at(120), Optional.empty()).orElseThrow();

        assertEquals(new BigDecimal("3.00"), run.minimumValue());
        assertEquals(new BigDecimal("3.01"), run.maximumValue());
        assertEquals(new BigDecimal("3.005"), run.latestValue());
    }

    @Test
    void permitsFluctuationBelowTheConfiguredTolerance() {
        var policy = new FlatlineDetector.Policy(Duration.ofMinutes(2), new BigDecimal("0.01"), Duration.ofMinutes(1));
        var readings = List.of(sensor(0, "3.000"), sensor(60, "3.009"), sensor(120, "3.005"));

        assertTrue(detector.detect(readings, policy, at(120), Optional.empty()).isPresent());
    }

    @Test
    void gradualDriftCannotHideBehindSmallAdjacentChanges() {
        var policy = new FlatlineDetector.Policy(Duration.ofMinutes(2), new BigDecimal("0.01"), Duration.ofMinutes(1));
        var readings = List.of(sensor(0, "3.000"), sensor(60, "3.006"), sensor(120, "3.012"));

        assertTrue(detector.detect(readings, policy, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void aGapLongerThanTheSuppliedLimitRestartsTheRun() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(181, "3"));

        assertTrue(detector.detect(readings, EXACT, at(181), Optional.empty()).isEmpty());
    }

    @Test
    void equalValuesOnEitherSideOfALongSilenceDoNotProveAFlatline() {
        var readings = List.of(sensor(0, "3"), sensor(7200, "3"));

        assertTrue(detector.detect(readings, EXACT, at(7200), Optional.empty()).isEmpty());
    }

    @Test
    void theCallerControlsTheGapLimitRatherThanAHardCodedMultiplier() {
        var strictPolicy = new FlatlineDetector.Policy(Duration.ofMinutes(2), BigDecimal.ZERO, Duration.ofSeconds(59));
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"));

        assertTrue(detector.detect(readings, strictPolicy, at(120), Optional.empty())
                .isEmpty());
        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isPresent());
    }

    @Test
    void manualReadingsNeitherClearNorTriggerSensorFlatlines() {
        var interleaved =
                List.of(sensor(0, "3"), manual(30, "99"), sensor(60, "3"), sensor(120, "3"), manual(180, "0"));
        var manualOnly = List.of(manual(0, "3"), manual(60, "3"), manual(120, "3"));

        var run = detector.detect(interleaved, EXACT, at(180), Optional.empty()).orElseThrow();
        assertEquals(at(120), run.lastReadingAt());
        assertTrue(detector.detect(manualOnly, EXACT, at(180), Optional.empty()).isEmpty());
    }

    @Test
    void manualReadingsCannotBridgeAGapBetweenSensorMeasurements() {
        var readings = List.of(sensor(0, "3"), manual(60, "3"), sensor(120, "3"));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void lateReadingsAreEvaluatedInMeasurementOrderWithoutMutatingTheInput() {
        var readings = new ArrayList<>(List.of(sensor(120, "3"), sensor(0, "3"), sensor(60, "3")));
        var original = List.copyOf(readings);

        var run = detector.detect(readings, EXACT, at(120), Optional.empty()).orElseThrow();

        assertEquals(START, run.unchangedSince());
        assertEquals(readings, original);
    }

    @Test
    void aLateChangedReadingCanInvalidateThePreviousRun() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(90, "4"));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void identicalRetriesAreNotAdditionalMeasurementEvidence() {
        var duplicates = List.of(sensor(0, "3"), sensor(0, "3.0"), sensor(0, "3.000000"));
        var complete = List.of(sensor(0, "3"), sensor(60, "3"), sensor(60, "3.0"), sensor(120, "3"));

        assertTrue(
                detector.detect(duplicates, EXACT, at(7200), Optional.empty()).isEmpty());
        assertTrue(detector.detect(complete, EXACT, at(120), Optional.empty()).isPresent());
    }

    @Test
    void conflictingValuesForOneTimestampAreRejected() {
        var readings = List.of(sensor(0, "3"), sensor(0, "4"));

        assertThrows(IllegalArgumentException.class, () -> detector.detect(readings, EXACT, at(120), Optional.empty()));
    }

    @Test
    void futureMeasurementsCannotTriggerOrClearAFlagBeforeTheirTime() {
        var notYetComplete = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"));
        var futureChange = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(180, "4"));

        assertTrue(detector.detect(notYetComplete, EXACT, at(119), Optional.empty())
                .isEmpty());
        assertTrue(
                detector.detect(futureChange, EXACT, at(120), Optional.empty()).isPresent());
        assertTrue(
                detector.detect(futureChange, EXACT, at(180), Optional.empty()).isEmpty());
    }

    @Test
    void activeMaintenancePausesSuppressWarnings() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"));

        assertTrue(
                detector.detect(readings, EXACT, at(120), Optional.of(at(180))).isEmpty());
    }

    @Test
    void expiryStartsFreshIncludingReadingsExactlyAtTheDeadline() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"), sensor(180, "3"), sensor(240, "3"));
        var expiry = Optional.of(at(120));

        assertTrue(detector.detect(readings, EXACT, at(120), expiry).isEmpty());
        assertTrue(detector.detect(readings, EXACT, at(239), expiry).isEmpty());
        var run = detector.detect(readings, EXACT, at(240), expiry).orElseThrow();
        assertEquals(at(120), run.unchangedSince());
        assertEquals(Duration.ofMinutes(2), run.observedDuration());
    }

    @Test
    void resumptionCannotReuseOldMeasurementsWhenNoFreshOnesArrive() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3"), sensor(120, "3"));

        assertTrue(
                detector.detect(readings, EXACT, at(7200), Optional.of(at(180))).isEmpty());
    }

    @Test
    void latePreExpiryMeasurementsStayExcludedAfterResumption() {
        var readings = List.of(sensor(120, "3"), sensor(180, "3"), sensor(240, "3"), sensor(119, "99"));

        var run =
                detector.detect(readings, EXACT, at(240), Optional.of(at(120))).orElseThrow();

        assertEquals(at(120), run.unchangedSince());
        assertEquals(new BigDecimal("3"), run.minimumValue());
        assertEquals(new BigDecimal("3"), run.maximumValue());
    }

    @Test
    void changingThePolicyReevaluatesTheHistory() {
        var readings = List.of(sensor(0, "3"), sensor(60, "3.01"), sensor(120, "3.005"));
        var tolerant =
                new FlatlineDetector.Policy(Duration.ofMinutes(2), new BigDecimal("0.01"), Duration.ofMinutes(1));
        var longer = new FlatlineDetector.Policy(Duration.ofMinutes(3), new BigDecimal("0.01"), Duration.ofMinutes(1));

        assertTrue(detector.detect(readings, EXACT, at(120), Optional.empty()).isEmpty());
        assertTrue(
                detector.detect(readings, tolerant, at(120), Optional.empty()).isPresent());
        assertTrue(detector.detect(readings, longer, at(120), Optional.empty()).isEmpty());
    }

    @Test
    void rejectsInvalidThresholdsTolerancesAndGapLimits() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new FlatlineDetector.Policy(Duration.ZERO, BigDecimal.ZERO, Duration.ofMinutes(1)));
        assertThrows(
                IllegalArgumentException.class,
                () -> new FlatlineDetector.Policy(Duration.ofSeconds(59), BigDecimal.ZERO, Duration.ofMinutes(1)));
        assertThrows(
                IllegalArgumentException.class,
                () -> new FlatlineDetector.Policy(Duration.ofSeconds(90), BigDecimal.ZERO, Duration.ofMinutes(1)));
        assertThrows(
                IllegalArgumentException.class,
                () -> new FlatlineDetector.Policy(
                        Duration.ofMinutes(2), new BigDecimal("-0.01"), Duration.ofMinutes(1)));
        assertThrows(
                IllegalArgumentException.class,
                () -> new FlatlineDetector.Policy(Duration.ofMinutes(2), BigDecimal.ZERO, Duration.ZERO));
    }

    private static Instant at(long seconds) {
        return START.plusSeconds(seconds);
    }

    private static FlatlineDetector.Reading sensor(long seconds, String value) {
        return new FlatlineDetector.Reading(at(seconds), new BigDecimal(value), true);
    }

    private static FlatlineDetector.Reading manual(long seconds, String value) {
        return new FlatlineDetector.Reading(at(seconds), new BigDecimal(value), false);
    }
}
