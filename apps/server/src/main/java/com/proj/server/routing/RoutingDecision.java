package com.proj.server.routing;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.Set;

/** Whether a classified report goes straight to a contractor or to the managing agent. */
public final class RoutingDecision {
    /** Fixed by agreement (ID-70); not a setting. */
    public static final BigDecimal CONFIDENCE_THRESHOLD = new BigDecimal("0.80");

    private static final Duration FIRST_RETRY = Duration.ofSeconds(30);
    private static final Duration LONGEST_RETRY = Duration.ofHours(1);

    private RoutingDecision() {}

    public sealed interface Result permits Route, Review {}

    public record Route(EquipmentType equipmentType) implements Result {}

    public record Review(String reason) implements Result {}

    public static Result decide(Classification classification, Set<EquipmentType> contractorTypes) {
        if (classification.outcome() != ClassificationOutcome.EQUIPMENT_FAULT)
            return new Review(classification.reason());
        if (classification.confidence().compareTo(CONFIDENCE_THRESHOLD) < 0)
            return new Review("Confidence below threshold");
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
