package com.proj.server.routing;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** One valid answer from the model. */
public record Classification(
        ClassificationOutcome outcome,
        EquipmentType equipmentType,
        BigDecimal confidence,
        String reason,
        String model) {
    private static final int MAX_REASON = 500;

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
