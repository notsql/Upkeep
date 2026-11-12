package com.proj.server.routing;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Set;

/** Whether a classified report goes straight to a contractor or to the managing agent. */
public final class RoutingDecision {
    /** Fixed by agreement (ID-70); not a setting. */
    public static final BigDecimal CONFIDENCE_THRESHOLD = new BigDecimal("0.80");

    /**
     * Categories whose model precision missed its target: they always wait for a Manager, however confident the
     * model is. fault-category-tfidf-v1: dumped items reached 0.90 precision at 0.80 against a 0.95 target.
     */
    public static final Set<FaultCategory> NEVER_AUTOMATIC = Set.of(FaultCategory.ILLEGAL_DUMPING);

    private static final Duration FIRST_RETRY = Duration.ofSeconds(30);
    private static final Duration LONGEST_RETRY = Duration.ofHours(1);

    private RoutingDecision() {}

    public sealed interface Result permits Route, Review {}

    public record Route(EquipmentType equipmentType) implements Result {}

    public record Review(String reason) implements Result {}

    public static Result decide(Classification classification, Set<EquipmentType> contractorTypes) {
        return decide(classification, contractorTypes, NEVER_AUTOMATIC);
    }

    static Result decide(
            Classification classification, Set<EquipmentType> contractorTypes, Set<FaultCategory> neverAutomatic) {
        if (classification.outcome() != ClassificationOutcome.EQUIPMENT_FAULT)
            return new Review(classification.reason());
        if (classification.confidence().compareTo(CONFIDENCE_THRESHOLD) < 0)
            return new Review("Confidence below threshold");
        if (classification.category() != null && neverAutomatic.contains(classification.category()))
            return new Review(classification.category().label() + " reports are always checked by a person");
        if (!contractorTypes.contains(classification.equipmentType()))
            return new Review("No " + classification.equipmentType() + " contractor configured");
        return new Route(classification.equipmentType());
    }

    /** Wait before the next attempt, after {@code attempts} failures: 30 s, quadrupling, at most an hour. */
    public static Duration backoff(int attempts) {
        var delay = FIRST_RETRY;
        for (int i = 1; i < attempts && delay.compareTo(LONGEST_RETRY) < 0; i++) delay = delay.multipliedBy(4);
        return delay.compareTo(LONGEST_RETRY) > 0 ? LONGEST_RETRY : delay;
    }
}
