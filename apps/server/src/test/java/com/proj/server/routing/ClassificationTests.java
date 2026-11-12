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

    // --- Fault category probabilities (fault-categories-and-report-page.md) ---------------------------------------

    private static double[] probabilities(FaultCategory top, double p) {
        var values = new double[FaultCategory.values().length];
        var rest = (1 - p) / (values.length - 1);
        for (int i = 0; i < values.length; i++) values[i] = i == top.ordinal() ? p : rest;
        return values;
    }

    @Test
    void aConfidentCategoryWithAContractorTypeIsAnEquipmentFault() {
        var result = Classification.fromProbabilities(probabilities(FaultCategory.WATER_LEAK, 0.94), "model-v1");

        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, result.outcome());
        assertEquals(EquipmentType.PLUMBING, result.equipmentType());
        assertEquals(FaultCategory.WATER_LEAK, result.category());
        assertEquals(new BigDecimal("0.94"), result.confidence());
        assertEquals("Water leak, 94% sure.", result.reason());
        assertEquals("model-v1", result.model());
    }

    @Test
    void exactlyTheThresholdIsConfidentEnough() {
        var result = Classification.fromProbabilities(probabilities(FaultCategory.RUBBISH, 0.80), "m");

        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, result.outcome());
        assertEquals(EquipmentType.CLEANING, result.equipmentType());
    }

    @Test
    void aConfidentSomethingElseIsNotEquipmentWithNoType() {
        var result = Classification.fromProbabilities(probabilities(FaultCategory.OTHER, 0.91), "m");

        assertEquals(ClassificationOutcome.NOT_EQUIPMENT, result.outcome());
        assertNull(result.equipmentType());
        assertEquals(FaultCategory.OTHER, result.category());
        assertEquals("Something else, 91% sure.", result.reason());
    }

    @Test
    void anUnsureAnswerIsInconclusiveAndSuggestsTheTopCategorysType() {
        var result = Classification.fromProbabilities(probabilities(FaultCategory.NOISE, 0.62), "m");

        assertEquals(ClassificationOutcome.INCONCLUSIVE, result.outcome());
        assertEquals(EquipmentType.SECURITY, result.equipmentType());
        assertEquals(FaultCategory.NOISE, result.category());
        assertEquals(new BigDecimal("0.62"), result.confidence());
        assertEquals("Probably noise (62% sure). Needs a check.", result.reason());
    }

    @Test
    void anUnsureSomethingElseIsInconclusiveWithNoType() {
        var result = Classification.fromProbabilities(probabilities(FaultCategory.OTHER, 0.5), "m");

        assertEquals(ClassificationOutcome.INCONCLUSIVE, result.outcome());
        assertNull(result.equipmentType());
    }

    @Test
    void theWrongNumberOfProbabilitiesIsAFailedAttempt() {
        assertThrows(ClassificationFailedException.class, () -> Classification.fromProbabilities(new double[2], "m"));
    }

    @Test
    void aManualChoiceIsCertainAndMarkedManual() {
        var routable = Classification.manual(FaultCategory.DRAINAGE);
        var other = Classification.manual(FaultCategory.OTHER);

        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, routable.outcome());
        assertEquals(EquipmentType.PLUMBING, routable.equipmentType());
        assertEquals(FaultCategory.DRAINAGE, routable.category());
        assertEquals(new BigDecimal("1.00"), routable.confidence());
        assertEquals(Classification.MANUAL, routable.model());
        assertEquals("manual", Classification.MANUAL);
        assertEquals("Blocked drain, chosen by hand.", routable.reason());
        assertEquals(ClassificationOutcome.NOT_EQUIPMENT, other.outcome());
        assertNull(other.equipmentType());
    }
}
