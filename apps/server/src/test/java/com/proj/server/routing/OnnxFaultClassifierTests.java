package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class OnnxFaultClassifierTests {
    @Test
    void theInputIsTheTitleThenTheDescription() {
        assertEquals(
                "Pipe burst water everywhere",
                OnnxFaultClassifier.input(new FaultClassifier.Report("Pipe burst", "water everywhere")));
    }

    @Test
    void theModelsProbabilitiesAreMappedAndLabelledWithItsVersion() {
        var model = mock(FaultCategoryModel.class);
        var probabilities = new double[FaultCategory.values().length];
        probabilities[FaultCategory.WATER_LEAK.ordinal()] = 0.94;
        probabilities[FaultCategory.DRAINAGE.ordinal()] = 0.06;
        when(model.predict("Pipe burst water everywhere")).thenReturn(probabilities);

        var result =
                new OnnxFaultClassifier(model).classify(new FaultClassifier.Report("Pipe burst", "water everywhere"));

        assertEquals(FaultCategory.WATER_LEAK, result.category());
        assertEquals(ClassificationOutcome.EQUIPMENT_FAULT, result.outcome());
        assertEquals("Water leak, 94% sure.", result.reason());
        assertEquals("fault-category-tfidf-v1", result.model());
        assertEquals(FaultCategoryModel.VERSION, result.model());
    }
}
