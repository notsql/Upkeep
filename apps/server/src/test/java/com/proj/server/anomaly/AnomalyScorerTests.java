package com.proj.server.anomaly;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * The in-process ONNX model reproduces the scores onnxruntime gave in Python for the parity fixture (copied from
 * ml-research/artifacts/pump-anomaly-platform/parity-fixture.json).
 */
class AnomalyScorerTests {

    /** The fixture's scores are float32 probabilities; 1e-5 allows for float32 noise, not for a wrong model or column. */
    private static final double TOLERANCE = 1e-5;

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Fixture(List<Row> rows) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Row(double[] features, double score) {}

    static AnomalyScorer scorer;

    @BeforeAll
    static void load() {
        scorer = new AnomalyScorer();
    }

    @AfterAll
    static void close() throws Exception {
        scorer.close();
    }

    private static Fixture fixture() throws IOException {
        try (InputStream in = AnomalyScorerTests.class.getResourceAsStream("/anomaly/parity-fixture.json")) {
            if (in == null) {
                throw new IllegalStateException("Missing test resource /anomaly/parity-fixture.json");
            }
            return JsonMapper.builder().build().readValue(in, Fixture.class);
        }
    }

    @Test
    void reproducesEveryScoreOfTheParityFixture() throws IOException {
        List<Row> rows = fixture().rows();
        double[][] features = rows.stream().map(Row::features).toArray(double[][]::new);

        double[] scores = scorer.scores(features);

        assertEquals(rows.size(), scores.length, "one score per row");
        for (int i = 0; i < scores.length; i++) {
            assertEquals(rows.get(i).score(), scores[i], TOLERANCE, "row " + i);
        }
    }

    @Test
    void inferenceFailingIsMlUnavailable() {
        // 14 features instead of 15: onnxruntime rejects the input shape.
        double[][] features = {new double[14]};

        assertThrows(MlUnavailableException.class, () -> scorer.scores(features));
    }

    @Test
    void aRowCountDifferentFromTheInputIsMlUnavailable() {
        float[][] probabilities = {{0.9f, 0.1f}};

        assertThrows(MlUnavailableException.class, () -> AnomalyScorer.anomalyColumn(probabilities, 2));
    }

    @Test
    void takesColumnOneOfEachRowInOrder() {
        float[][] probabilities = {{0.75f, 0.25f}, {0.5f, 0.5f}};

        assertArrayEquals(new double[] {0.25, 0.5}, AnomalyScorer.anomalyColumn(probabilities, 2));
    }

    @Test
    void aMissingModelFailsToLoad() {
        assertThrows(IllegalStateException.class, () -> new AnomalyScorer("/anomaly/no-such-model.onnx"));
    }
}
