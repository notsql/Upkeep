package com.proj.server.risk;

import static com.proj.server.event.AssetEventType.BREAKDOWN_REPAIR;
import static com.proj.server.event.AssetEventType.PREVENTIVE;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.proj.server.event.AssetEventType;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The breakdown forecast from the spec's "Breakdown forecast" and "End of life" sections. "Today" is
 * pinned so every value is deterministic.
 */
class FailureRiskCalculatorTests {
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 11);

    // b0 = a0 * (m / Gamma(1 + 1/k))^k with m = 1095, k = 1.2, a0 = 0.5 (computed independently).
    private static final double B0 = 2388.636310487805;
    // 1095^1.2: a 3-year closed interval's contribution to b.
    private static final double THREE_YEARS_TO_THE_K = 4439.12059092019;

    private static final UUID GRUNDFOS = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID CR10 = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private static final UUID EBARA = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private static final UUID EVMS = UUID.fromString("00000000-0000-0000-0000-00000000000d");

    private final FailureRiskCalculator calculator = new FailureRiskCalculator();

    private static LocalDate daysAgo(int days) {
        return TODAY.minusDays(days);
    }

    private static RiskAsset pump(LocalDate installedOn) {
        return new RiskAsset("PUMP", installedOn, GRUNDFOS, CR10);
    }

    private static RiskEvent event(AssetEventType type, LocalDate occurredOn) {
        return new RiskEvent(type, occurredOn, GRUNDFOS, CR10);
    }

    private static void assertRoundsTo(double expected, Double actual) {
        assertEquals(expected, Math.round(actual * 100) / 100.0, "rounded " + actual);
    }

    // --- The four scenarios in the Breakdown forecast table ---

    @Test
    void aNewPumpHasAboutOnePercentRiskIn30DaysAndFourIn90() {
        var forecast = calculator.forecast(pump(TODAY), List.of(), TODAY);
        assertRoundsTo(0.01, forecast.probability30Days());
        assertRoundsTo(0.04, forecast.probability90Days());
    }

    @Test
    void aPumpThreeYearsInServiceWithNoBreakdownsHasAboutOnePercentIn30DaysAndThreeIn90() {
        var forecast = calculator.forecast(pump(daysAgo(1095)), List.of(), TODAY);
        assertRoundsTo(0.01, forecast.probability30Days());
        assertRoundsTo(0.03, forecast.probability90Days());
    }

    @Test
    void aPumpThatBrokeDownTwice180DaysApartLast90DaysAgo() {
        // Intervals: install -> 180 days -> breakdown -> 180 days -> breakdown -> 90 days -> today.
        var events = List.of(event(BREAKDOWN_REPAIR, daysAgo(270)), event(BREAKDOWN_REPAIR, daysAgo(90)));
        var forecast = calculator.forecast(pump(daysAgo(450)), events, TODAY);
        assertRoundsTo(0.06, forecast.probability30Days());
        assertRoundsTo(0.17, forecast.probability90Days());
        assertEquals(90, forecast.daysSinceLastEvent());
        assertEquals(2, forecast.failuresObserved());
    }

    @Test
    void aPumpThatBrokeDownFourTimes90DaysApartLast60DaysAgo() {
        var events = List.of(
                event(BREAKDOWN_REPAIR, daysAgo(330)),
                event(BREAKDOWN_REPAIR, daysAgo(240)),
                event(BREAKDOWN_REPAIR, daysAgo(150)),
                event(BREAKDOWN_REPAIR, daysAgo(60)));
        var forecast = calculator.forecast(pump(daysAgo(420)), events, TODAY);
        assertRoundsTo(0.11, forecast.probability30Days());
        assertRoundsTo(0.29, forecast.probability90Days());
        assertEquals(60, forecast.daysSinceLastEvent());
        assertEquals(4, forecast.failuresObserved());
    }

    @Test
    void probabilitiesRiseWithTheHorizon() {
        var forecast = calculator.forecast(pump(daysAgo(1095)), List.of(), TODAY);
        assertTrue(forecast.probability30Days() < forecast.probability60Days());
        assertTrue(forecast.probability60Days() < forecast.probability90Days());
    }

    // --- How events update the posterior ---

    @Test
    void withNoEventsThePosteriorIsThePrior() {
        var posterior = calculator.posterior(pump(daysAgo(1095)), List.of());
        assertEquals(0.5, posterior.a(), 1e-9);
        assertEquals(B0, posterior.b(), 1e-6);
    }

    @Test
    void aBreakdownRepairRaisesAAndAddsItsIntervalToB() {
        var posterior = calculator.posterior(pump(daysAgo(1095)), List.of(event(BREAKDOWN_REPAIR, TODAY)));
        assertEquals(1.5, posterior.a(), 1e-9);
        assertEquals(B0 + THREE_YEARS_TO_THE_K, posterior.b(), 1e-6);
    }

    @Test
    void aPreventiveIntervalRaisesOnlyB() {
        var posterior = calculator.posterior(pump(daysAgo(1095)), List.of(event(PREVENTIVE, TODAY)));
        assertEquals(0.5, posterior.a(), 1e-9);
        assertEquals(B0 + THREE_YEARS_TO_THE_K, posterior.b(), 1e-6);
    }

    @Test
    void twoEventsOnTheSameDateFormAZeroLengthInterval() {
        var posterior = calculator.posterior(
                pump(daysAgo(1095)), List.of(event(PREVENTIVE, TODAY), event(BREAKDOWN_REPAIR, TODAY)));
        assertEquals(1.5, posterior.a(), 1e-9);
        assertEquals(B0 + THREE_YEARS_TO_THE_K, posterior.b(), 1e-6);
    }

    // --- Which events count ---

    @Test
    void eventsBeforeInstalledOnDoNotCount() {
        var asset = pump(daysAgo(450));
        var beforeInstall = event(BREAKDOWN_REPAIR, daysAgo(451));
        assertFalse(calculator.counts(asset, beforeInstall));
        assertTrue(calculator.counts(asset, event(BREAKDOWN_REPAIR, daysAgo(450))));

        var forecast = calculator.forecast(asset, List.of(beforeInstall), TODAY);
        var clean = calculator.forecast(asset, List.of(), TODAY);
        assertEquals(0, forecast.failuresObserved());
        assertEquals(FailureRiskBasis.SERVICE_INTERVAL, forecast.basis());
        assertEquals(clean.probability90Days(), forecast.probability90Days(), 1e-12);
    }

    @Test
    void eventsForADifferentManufacturerOrModelDoNotCount() {
        var asset = pump(daysAgo(450));
        var otherManufacturer = new RiskEvent(BREAKDOWN_REPAIR, daysAgo(200), EBARA, CR10);
        var otherModel = new RiskEvent(BREAKDOWN_REPAIR, daysAgo(100), GRUNDFOS, EVMS);
        assertFalse(calculator.counts(asset, otherManufacturer));
        assertFalse(calculator.counts(asset, otherModel));

        var forecast = calculator.forecast(asset, List.of(otherManufacturer, otherModel), TODAY);
        var clean = calculator.forecast(asset, List.of(), TODAY);
        assertEquals(0, forecast.failuresObserved());
        assertEquals(clean.probability90Days(), forecast.probability90Days(), 1e-12);
        // u runs from installedOn when no event counts.
        assertEquals(450, forecast.daysSinceLastEvent());
    }

    @Test
    void aNullSnapshotMatchesOnlyANullUnit() {
        var unrecorded = new RiskAsset("PUMP", daysAgo(450), null, null);
        assertTrue(calculator.counts(unrecorded, new RiskEvent(BREAKDOWN_REPAIR, daysAgo(10), null, null)));
        assertFalse(calculator.counts(unrecorded, event(BREAKDOWN_REPAIR, daysAgo(10))));
        assertFalse(calculator.counts(pump(daysAgo(450)), new RiskEvent(BREAKDOWN_REPAIR, daysAgo(10), null, null)));
    }

    // --- Basis ---

    @Test
    void aPumpWithNoCountingBreakdownIsForecastFromTheServiceInterval() {
        var forecast = calculator.forecast(pump(daysAgo(400)), List.of(event(PREVENTIVE, daysAgo(100))), TODAY);
        assertEquals(FailureRiskBasis.SERVICE_INTERVAL, forecast.basis());
        assertEquals(0, forecast.failuresObserved());
        assertEquals(100, forecast.daysSinceLastEvent());
    }

    @Test
    void aPumpWithACountingBreakdownIsForecastFromItsHistory() {
        var forecast = calculator.forecast(
                pump(daysAgo(400)),
                List.of(event(BREAKDOWN_REPAIR, daysAgo(200)), event(PREVENTIVE, daysAgo(100))),
                TODAY);
        assertEquals(FailureRiskBasis.ASSET_HISTORY, forecast.basis());
        assertEquals(1, forecast.failuresObserved());
    }

    @Test
    void aPumpWithNoInstallDateAndNoCountingEventsHasInsufficientData() {
        var forecast = calculator.forecast(new RiskAsset("PUMP", null, null, null), List.of(), TODAY);
        assertEquals(FailureRiskBasis.INSUFFICIENT_DATA, forecast.basis());
        assertNull(forecast.probability30Days());
        assertNull(forecast.probability60Days());
        assertNull(forecast.probability90Days());
        assertNull(forecast.recommendedTimeframe());
    }

    @Test
    void aNonPumpIsNotSupportedAndHasNoProbabilities() {
        var lift = new RiskAsset("LIFT", daysAgo(400), null, null);
        var forecast = calculator.forecast(lift, List.of(new RiskEvent(BREAKDOWN_REPAIR, daysAgo(10), null, null)), TODAY);
        assertEquals(FailureRiskBasis.NOT_SUPPORTED, forecast.basis());
        assertNull(forecast.probability30Days());
        assertNull(forecast.probability60Days());
        assertNull(forecast.probability90Days());
        assertNull(forecast.recommendedTimeframe());
    }

    // --- Recommended timeframe (threshold 0.15) ---

    @Test
    void aTypicalPumpIsBeyond90Days() {
        var forecast = calculator.forecast(pump(TODAY), List.of(), TODAY);
        assertEquals(RecommendedTimeframe.BEYOND_90_DAYS, forecast.recommendedTimeframe());
    }

    @Test
    void theTimeframeIsTheFirstHorizonReachingTheThreshold() {
        // P30 = 0.11, P60 = 0.20: 60 days is the first to reach 0.15.
        var fourBreakdowns = List.of(
                event(BREAKDOWN_REPAIR, daysAgo(330)),
                event(BREAKDOWN_REPAIR, daysAgo(240)),
                event(BREAKDOWN_REPAIR, daysAgo(150)),
                event(BREAKDOWN_REPAIR, daysAgo(60)));
        assertEquals(
                RecommendedTimeframe.WITHIN_60_DAYS,
                calculator.forecast(pump(daysAgo(420)), fourBreakdowns, TODAY).recommendedTimeframe());

        // P60 = 0.12, P90 = 0.17.
        var twoBreakdowns = List.of(event(BREAKDOWN_REPAIR, daysAgo(270)), event(BREAKDOWN_REPAIR, daysAgo(90)));
        assertEquals(
                RecommendedTimeframe.WITHIN_90_DAYS,
                calculator.forecast(pump(daysAgo(450)), twoBreakdowns, TODAY).recommendedTimeframe());

        // Eight breakdowns 20 days apart, last 5 days ago: P30 = 0.18.
        var eightBreakdowns = List.of(
                event(BREAKDOWN_REPAIR, daysAgo(145)),
                event(BREAKDOWN_REPAIR, daysAgo(125)),
                event(BREAKDOWN_REPAIR, daysAgo(105)),
                event(BREAKDOWN_REPAIR, daysAgo(85)),
                event(BREAKDOWN_REPAIR, daysAgo(65)),
                event(BREAKDOWN_REPAIR, daysAgo(45)),
                event(BREAKDOWN_REPAIR, daysAgo(25)),
                event(BREAKDOWN_REPAIR, daysAgo(5)));
        assertEquals(
                RecommendedTimeframe.WITHIN_30_DAYS,
                calculator.forecast(pump(daysAgo(165)), eightBreakdowns, TODAY).recommendedTimeframe());
    }

    @Test
    void theThresholdIsFifteenPercent() {
        // Two breakdowns 180 days apart. Repaired today: P90 = 0.146, just under the threshold.
        var justUnder = List.of(event(BREAKDOWN_REPAIR, daysAgo(180)), event(BREAKDOWN_REPAIR, TODAY));
        var under = calculator.forecast(pump(daysAgo(360)), justUnder, TODAY);
        assertRoundsTo(0.15, under.probability90Days());
        assertTrue(under.probability90Days() < FailureRiskConstants.RISK_THRESHOLD);
        assertEquals(RecommendedTimeframe.BEYOND_90_DAYS, under.recommendedTimeframe());

        // The same history repaired 30 days ago: P90 = 0.162, just over.
        var justOver = List.of(event(BREAKDOWN_REPAIR, daysAgo(210)), event(BREAKDOWN_REPAIR, daysAgo(30)));
        var over = calculator.forecast(pump(daysAgo(390)), justOver, TODAY);
        assertTrue(over.probability90Days() >= FailureRiskConstants.RISK_THRESHOLD);
        assertEquals(RecommendedTimeframe.WITHIN_90_DAYS, over.recommendedTimeframe());
    }

    // --- End of life ---

    @Test
    void theExpectedEndOfLifeIsFifteenYearsAfterInstallation() {
        var forecast = calculator.forecast(pump(LocalDate.of(2020, 3, 15)), List.of(), TODAY);
        assertEquals(LocalDate.of(2035, 3, 15), forecast.expectedEndOfLife());
    }

    @Test
    void aPumpWithNoInstallDateHasNoEndOfLife() {
        var forecast = calculator.forecast(new RiskAsset("PUMP", null, null, null), List.of(), TODAY);
        assertNull(forecast.expectedEndOfLife());
        assertFalse(forecast.nearingEndOfLife());
    }

    @Test
    void aPumpIsNearingEndOfLifeFromTwelveYearsOfAge() {
        var twelveYearsToday = calculator.forecast(pump(TODAY.minusYears(12)), List.of(), TODAY);
        assertTrue(twelveYearsToday.nearingEndOfLife());

        var twelveYearsTomorrow = calculator.forecast(pump(TODAY.minusYears(12).plusDays(1)), List.of(), TODAY);
        assertFalse(twelveYearsTomorrow.nearingEndOfLife());
    }
}
