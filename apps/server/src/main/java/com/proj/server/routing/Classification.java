package com.proj.server.routing;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** One valid answer from the model. */
public record Classification(
        ClassificationOutcome outcome,
        EquipmentType equipmentType,
        BigDecimal confidence,
        String reason,
        String model,
        FaultCategory category) {
    private static final int MAX_REASON = 500;
    private static final BigDecimal THRESHOLD = RoutingDecision.CONFIDENCE_THRESHOLD;

    /** The model name on a row a person chose. */
    public static final String MANUAL = "manual";

    /** An answer with no fault category, as the water leak model and older rows give. */
    public Classification(
            ClassificationOutcome outcome,
            EquipmentType equipmentType,
            BigDecimal confidence,
            String reason,
            String model) {
        this(outcome, equipmentType, confidence, reason, model, null);
    }

    /**
     * Maps the fault category model's calibrated probabilities, one per {@link FaultCategory} in declaration order,
     * onto an outcome: a confident category with a contractor type is an equipment fault, a confident one without is
     * not equipment, and anything else is inconclusive with the top category's type as a suggestion.
     */
    public static Classification fromProbabilities(double[] probabilities, String model) {
        var categories = FaultCategory.values();
        if (probabilities == null || probabilities.length != categories.length)
            throw new ClassificationFailedException("The model returned the wrong number of categories.");
        var top = 0;
        for (int i = 1; i < probabilities.length; i++) if (probabilities[i] > probabilities[top]) top = i;
        var category = categories[top];
        var p = probabilities[top];
        if (Double.isNaN(p) || p < 0 || p > 1)
            throw new ClassificationFailedException("The model's confidence was outside 0 to 1.");
        var confidence = BigDecimal.valueOf(p).setScale(2, RoundingMode.HALF_UP);
        var percent = Math.round(p * 100);
        if (BigDecimal.valueOf(p).compareTo(THRESHOLD) >= 0)
            return new Classification(
                    category.equipmentType() == null
                            ? ClassificationOutcome.NOT_EQUIPMENT
                            : ClassificationOutcome.EQUIPMENT_FAULT,
                    category.equipmentType(),
                    confidence,
                    "%s, %d%% sure.".formatted(category.label(), percent),
                    model,
                    category);
        return new Classification(
                ClassificationOutcome.INCONCLUSIVE,
                category.equipmentType(),
                confidence,
                "Probably %s (%d%% sure). Needs a check."
                        .formatted(category.label().toLowerCase(), percent),
                model,
                category);
    }

    /** A category a person chose: certain, and routed like a confident model answer would be. */
    public static Classification manual(FaultCategory category) {
        return new Classification(
                category.equipmentType() == null
                        ? ClassificationOutcome.NOT_EQUIPMENT
                        : ClassificationOutcome.EQUIPMENT_FAULT,
                category.equipmentType(),
                BigDecimal.ONE.setScale(2),
                category.label() + ", chosen by hand.",
                MANUAL,
                category);
    }

    /**
     * Validates a raw model answer; anything incomplete or unknown is a failed attempt. {@code NONE} means no
     * equipment type, which an equipment fault must not have.
     */
    public static Classification of(
            String outcome, String equipmentType, double confidence, String reason, String model) {
        ClassificationOutcome parsedOutcome;
        EquipmentType parsedType;
        try {
            parsedOutcome = ClassificationOutcome.valueOf(outcome);
            parsedType =
                    equipmentType == null || "NONE".equals(equipmentType) ? null : EquipmentType.valueOf(equipmentType);
        } catch (IllegalArgumentException | NullPointerException unknown) {
            throw new ClassificationFailedException("The model answered with an unknown value.");
        }
        if (equipmentType == null) throw new ClassificationFailedException("The model gave no equipment type.");
        if (parsedOutcome == ClassificationOutcome.EQUIPMENT_FAULT && parsedType == null)
            throw new ClassificationFailedException("An equipment fault needs an equipment type.");
        if (Double.isNaN(confidence) || confidence < 0 || confidence > 1)
            throw new ClassificationFailedException("The model's confidence was outside 0 to 1.");
        if (reason == null || reason.isBlank()) throw new ClassificationFailedException("The model gave no reason.");
        var trimmed = reason.strip();
        return new Classification(
                parsedOutcome,
                parsedType,
                BigDecimal.valueOf(confidence).setScale(2, RoundingMode.HALF_UP),
                trimmed.length() > MAX_REASON ? trimmed.substring(0, MAX_REASON) : trimmed,
                model);
    }
}
