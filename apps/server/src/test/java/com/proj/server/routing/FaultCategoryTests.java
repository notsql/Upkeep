package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class FaultCategoryTests {
    @Test
    void theCategoriesAreInTheModelsOutputOrder() {
        assertEquals(
                List.of(
                        "BROKEN_LIGHT",
                        "DRAINAGE",
                        "GRAFFITI",
                        "ILLEGAL_DUMPING",
                        "NOISE",
                        "OTHER",
                        "PARKING",
                        "ROAD_DAMAGE",
                        "RUBBISH",
                        "WATER_LEAK"),
                Arrays.stream(FaultCategory.values()).map(Enum::name).toList());
    }

    @ParameterizedTest
    @CsvSource({
        "ROAD_DAMAGE, Damaged road or path, REPAIRS",
        "RUBBISH, Rubbish or litter, CLEANING",
        "BROKEN_LIGHT, Broken light, LIGHT",
        "WATER_LEAK, Water leak, PLUMBING",
        "NOISE, Noise, SECURITY",
        "GRAFFITI, Graffiti or vandalism, REPAIRS",
        "DRAINAGE, Blocked drain, PLUMBING",
        "ILLEGAL_DUMPING, Dumped items, CLEANING",
        "PARKING, Parking, SECURITY"
    })
    void eachCategoryHasAPlainLabelAndAContractorType(String category, String label, String type) {
        var parsed = FaultCategory.valueOf(category);

        assertEquals(label, parsed.label());
        assertEquals(EquipmentType.valueOf(type), parsed.equipmentType());
    }

    @Test
    void somethingElseIsAlwaysAManagerDecision() {
        assertEquals("Something else", FaultCategory.OTHER.label());
        assertNull(FaultCategory.OTHER.equipmentType());
    }

    @Test
    void theNewContractorTypesHavePlainLabels() {
        assertEquals("Cleaning", EquipmentType.CLEANING.label());
        assertEquals("Painting and repairs", EquipmentType.REPAIRS.label());
        assertEquals("Security", EquipmentType.SECURITY.label());
    }
}
