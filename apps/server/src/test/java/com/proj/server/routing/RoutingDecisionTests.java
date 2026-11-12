package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class RoutingDecisionTests {
    private static final Set<EquipmentType> ALL = Set.of(EquipmentType.values());

    @ParameterizedTest
    @CsvSource({"0.80, true", "0.81, true", "1.00, true", "0.79, false", "0.00, false"})
    void anEquipmentFaultIsRoutedOnlyAtOrAboveTheThreshold(String confidence, boolean routed) {
        var result = RoutingDecision.decide(classification("EQUIPMENT_FAULT", "LIFT", confidence), ALL);

        if (routed) {
            assertEquals(new RoutingDecision.Route(EquipmentType.LIFT), result);
        } else {
            assertEquals(new RoutingDecision.Review("Confidence below threshold"), result);
        }
    }

    @Test
    void anInconclusiveAnswerGoesToReviewWithTheModelsReasonWhateverTheConfidence() {
        var result = RoutingDecision.decide(classification("INCONCLUSIVE", "LIFT", "0.95"), ALL);

        assertEquals(new RoutingDecision.Review("Water near the lift needs an on-site check"), result);
    }

    @Test
    void aNonEquipmentAnswerGoesToReviewWithTheModelsReason() {
        var result = RoutingDecision.decide(classification("NOT_EQUIPMENT", null, "0.99"), ALL);

        assertEquals(new RoutingDecision.Review("Water near the lift needs an on-site check"), result);
    }

    @Test
    void aConfidentFaultWithoutAContractorForItsTypeGoesToReview() {
        var result = RoutingDecision.decide(
                classification("EQUIPMENT_FAULT", "GATE", "0.99"), Set.of(EquipmentType.LIFT, EquipmentType.PUMP));

        assertEquals(new RoutingDecision.Review("No GATE contractor configured"), result);
    }

    @Test
    void dumpedItemsAreHeldBackBecauseTheModelMissedItsPrecisionTarget() {
        // fault-category-tfidf-v1 metrics.json: ILLEGAL_DUMPING precision 0.90 at 0.80, below the 0.95 target.
        assertEquals(Set.of(FaultCategory.ILLEGAL_DUMPING), RoutingDecision.NEVER_AUTOMATIC);
        var dumped = Classification.fromProbabilities(oneHot(FaultCategory.ILLEGAL_DUMPING), "m");
        assertEquals(
                new RoutingDecision.Review("Dumped items reports are always checked by a person"),
                RoutingDecision.decide(dumped, ALL));
    }

    @Test
    void aCategoryMarkedNeverAutomaticGoesToReviewEvenWhenConfident() {
        var noise = Classification.fromProbabilities(oneHot(FaultCategory.NOISE), "m");

        assertEquals(
                new RoutingDecision.Review("Noise reports are always checked by a person"),
                RoutingDecision.decide(noise, ALL, Set.of(FaultCategory.NOISE)));
        assertEquals(
                new RoutingDecision.Route(EquipmentType.SECURITY),
                RoutingDecision.decide(noise, ALL, Set.of(FaultCategory.PARKING)));
    }

    private static double[] oneHot(FaultCategory category) {
        var values = new double[FaultCategory.values().length];
        values[category.ordinal()] = 1;
        return values;
    }

    @Test
    void retriesWaitLongerEachTimeUpToAnHour() {
        assertEquals(Duration.ofSeconds(30), RoutingDecision.backoff(1));
        assertEquals(Duration.ofMinutes(2), RoutingDecision.backoff(2));
        assertEquals(Duration.ofMinutes(8), RoutingDecision.backoff(3));
        assertEquals(Duration.ofMinutes(32), RoutingDecision.backoff(4));
        assertEquals(Duration.ofHours(1), RoutingDecision.backoff(5));
        assertEquals(Duration.ofHours(1), RoutingDecision.backoff(12));
    }

    private static Classification classification(String outcome, String type, String confidence) {
        return new Classification(
                ClassificationOutcome.valueOf(outcome),
                type == null ? null : EquipmentType.valueOf(type),
                new BigDecimal(confidence),
                "Water near the lift needs an on-site check",
                "claude-haiku-5-5");
    }
}
