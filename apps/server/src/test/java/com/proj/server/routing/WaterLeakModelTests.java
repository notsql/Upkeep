package com.proj.server.routing;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * Spring reproduces the tokens and probabilities that Python gave for the parity fixture (copied from
 * ml-research/artifacts/water-leak/parity-fixture.json).
 */
class WaterLeakModelTests {
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Fixture(String modelVersion, List<Row> rows) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Row(String title, String description, String input, long[] tokenIds, double[] probabilities) {}

    static WaterLeakModel model;

    @BeforeAll
    static void load() {
        model = new WaterLeakModel();
    }

    @AfterAll
    static void close() {
        model.close();
    }

    private static Fixture fixture() throws IOException {
        try (InputStream in = WaterLeakModelTests.class.getResourceAsStream("/routing/parity-fixture.json")) {
            if (in == null) throw new IllegalStateException("Missing test resource /routing/parity-fixture.json");
            return JsonMapper.builder().build().readValue(in, Fixture.class);
        }
    }

    @Test
    void theFixtureIsForThisModelVersion() throws IOException {
        assertEquals(WaterLeakModel.VERSION, fixture().modelVersion());
    }

    @Test
    void joinsTitleAndDescriptionAsTheFixtureDid() throws IOException {
        for (var row : fixture().rows()) {
            assertEquals(
                    row.input(), OnnxFaultClassifier.input(new FaultClassifier.Report(row.title(), row.description())));
        }
    }

    @Test
    void producesTheFixtureTokens() throws IOException {
        for (var row : fixture().rows()) {
            assertArrayEquals(row.tokenIds(), model.tokenIds(row.input()), row.input());
        }
    }

    @Test
    void reproducesTheFixtureProbabilities() throws IOException {
        for (var row : fixture().rows()) {
            var prediction = model.predict(row.input());
            assertEquals(row.probabilities()[0], prediction.notLeak(), TOLERANCE, row.input());
            assertEquals(row.probabilities()[1], prediction.leak(), TOLERANCE, row.input());
        }
    }

    /**
     * The int8 model differs between CPU types: the fixture came from Apple Silicon, and Linux amd64 differs by up to
     * 0.05 on its odd inputs. This still catches a wrong model or class order.
     */
    private static final double TOLERANCE = 0.06;
}
