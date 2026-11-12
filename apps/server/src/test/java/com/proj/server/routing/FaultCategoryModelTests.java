package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Spring reproduces the probabilities Python gave for the parity fixture (copied from
 * ml-research/artifacts/fault-category-tfidf/parity-fixture.json).
 */
class FaultCategoryModelTests {
    private static final double TOLERANCE = 1e-4;

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Fixture(String model, List<String> categories, List<Case> cases) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Case(String text, double[] probabilities) {}

    static FaultCategoryModel model;

    @BeforeAll
    static void load() {
        model = new FaultCategoryModel();
    }

    @AfterAll
    static void close() {
        model.close();
    }

    private static Fixture fixture() throws IOException {
        try (InputStream in =
                FaultCategoryModelTests.class.getResourceAsStream("/routing/fault-category-parity-fixture.json")) {
            if (in == null) throw new IllegalStateException("Missing fault category parity fixture");
            return JsonMapper.builder().build().readValue(in, Fixture.class);
        }
    }

    @Test
    void theFixtureIsForThisModelVersionAndCategoryOrder() throws IOException {
        var fixture = fixture();
        assertEquals(FaultCategoryModel.VERSION, fixture.model());
        assertEquals(Arrays.stream(FaultCategory.values()).map(Enum::name).toList(), fixture.categories());
    }

    @Test
    void reproducesTheFixtureProbabilities() throws IOException {
        var cases = fixture().cases();
        assertEquals(true, cases.size() >= 10, "the fixture has cases");
        for (var row : cases) {
            var probabilities = model.predict(row.text());
            assertEquals(FaultCategory.values().length, probabilities.length);
            for (int i = 0; i < probabilities.length; i++)
                assertEquals(row.probabilities()[i], probabilities[i], TOLERANCE, row.text() + " #" + i);
        }
    }
}
