package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ClassificationTests {
    @Test
    void aValidAnswerBecomesAClassificationRoundedToTwoPlaces() {
        var result = Classification.of("EQUIPMENT_FAULT", "LIFT", 0.876, "Lift doors stuck", "claude-haiku-5-5");

        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, result.outcome());
        assertEquals(EquipmentType.LIFT, result.equipmentType());
        assertEquals(new BigDecimal("0.88"), result.confidence());
        assertEquals("Lift doors stuck", result.reason());
        assertEquals("claude-haiku-5-5", result.model());
    }

    @Test
    void noneMeansNoEquipmentType() {
        var result = Classification.of("NOT_EQUIPMENT", "NONE", 0.9, "Litter in the corridor", "m");

        assertNull(result.equipmentType());
    }

    @Test
    void anOverlongReasonIsCutTo500Characters() {
        var result = Classification.of("INCONCLUSIVE", "NONE", 0.5, "x".repeat(600), "m");

        assertEquals(500, result.reason().length());
    }

    @ParameterizedTest
    @CsvSource(
            nullValues = "null",
            value = {
                "BROKEN, LIFT, 0.9, reason",
                "null, LIFT, 0.9, reason",
                "EQUIPMENT_FAULT, ESCALATOR, 0.9, reason",
                "EQUIPMENT_FAULT, NONE, 0.9, reason",
                "EQUIPMENT_FAULT, null, 0.9, reason",
                "EQUIPMENT_FAULT, LIFT, 1.2, reason",
                "EQUIPMENT_FAULT, LIFT, -0.1, reason",
                "EQUIPMENT_FAULT, LIFT, NaN, reason",
                "EQUIPMENT_FAULT, LIFT, 0.9, null",
                "EQUIPMENT_FAULT, LIFT, 0.9, '  '"
            })
    void anIncompleteOrUnknownAnswerIsAFailedAttempt(String outcome, String type, double confidence, String reason) {
        assertThrows(
                ClassificationFailedException.class, () -> Classification.of(outcome, type, confidence, reason, "m"));
    }
}
