package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class OnnxFaultClassifierTests {
    @Test
    void aConfidentLeakIsARoutablePlumbingFault() {
        var result = OnnxFaultClassifier.classification(0.94, 0.06);

        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, result.outcome());
        assertEquals(EquipmentType.PLUMBING, result.equipmentType());
        assertEquals(new BigDecimal("0.94"), result.confidence());
        assertEquals("Water leak, 94% confidence.", result.reason());
        assertEquals(WaterLeakModel.VERSION, result.model());
    }

    @Test
    void exactlyTheThresholdIsConfidentEnough() {
        assertEquals(
                ClassificationOutcome.EQUIPMENT_FAULT,
                OnnxFaultClassifier.classification(0.80, 0.20).outcome());
        assertEquals(
                ClassificationOutcome.NOT_EQUIPMENT,
                OnnxFaultClassifier.classification(0.20, 0.80).outcome());
    }

    @Test
    void aConfidentNonLeakHasNoEquipmentType() {
        var result = OnnxFaultClassifier.classification(0.09, 0.91);

        assertEquals(ClassificationOutcome.NOT_EQUIPMENT, result.outcome());
        assertNull(result.equipmentType());
        assertEquals(new BigDecimal("0.91"), result.confidence());
        assertEquals("Not a water leak, 91% confidence.", result.reason());
    }

    @Test
    void anUnsureLeakIsInconclusiveAndSuggestsPlumbing() {
        var result = OnnxFaultClassifier.classification(0.62, 0.38);

        assertEquals(ClassificationOutcome.INCONCLUSIVE, result.outcome());
        assertEquals(EquipmentType.PLUMBING, result.equipmentType());
        assertEquals(new BigDecimal("0.62"), result.confidence());
        assertEquals("Unclear whether this is a water leak (62% leak). Needs a check on site.", result.reason());
    }

    @Test
    void anUnsureNonLeakIsInconclusiveWithNoType() {
        var result = OnnxFaultClassifier.classification(0.35, 0.65);

        assertEquals(ClassificationOutcome.INCONCLUSIVE, result.outcome());
        assertNull(result.equipmentType());
        assertEquals(new BigDecimal("0.65"), result.confidence());
    }

    @Test
    void anEvenSplitIsInconclusiveWithNoType() {
        var result = OnnxFaultClassifier.classification(0.5, 0.5);

        assertEquals(ClassificationOutcome.INCONCLUSIVE, result.outcome());
        assertNull(result.equipmentType());
    }

    @Test
    void theInputIsTheTitleThenTheDescription() {
        assertEquals(
                "Pipe burst water everywhere",
                OnnxFaultClassifier.input(new FaultClassifier.Report("Pipe burst", "water everywhere")));
    }
}
