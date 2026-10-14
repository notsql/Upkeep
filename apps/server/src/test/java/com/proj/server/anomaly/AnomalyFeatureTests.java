package com.proj.server.anomaly;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * The feature builder reproduces the training notebook's features (phase 0b parity fixture, copied from
 * ml-research/artifacts/pump-anomaly-platform/parity-fixture.json).
 */
class AnomalyFeatureTests {

    /**
     * Absolute tolerance. The fixture was computed in float64 by pandas; a plain two-pass mean and sample std in
     * Java double agrees with it to about 4e-14 (the largest value is a temperature near 74). 1e-9 leaves room for
     * summation-order noise yet is far tighter than any real mistake: ddof=0 instead of 1, an off-by-one window,
     * or a window that does not restart at the batch start all move features by more than 1e-6.
     */
    private static final double TOLERANCE = 1e-9;

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Fixture(List<String> feature_order, List<Row> rows) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Row(AnomalyCheckRequest.Reading reading, double[] features) {}

    private static Fixture fixture() throws IOException {
        try (InputStream in = AnomalyFeatureTests.class.getResourceAsStream("/anomaly/parity-fixture.json")) {
            if (in == null) {
                throw new IllegalStateException("Missing test resource /anomaly/parity-fixture.json");
            }
            return JsonMapper.builder().build().readValue(in, Fixture.class);
        }
    }

    @Test
    void featureOrderMatchesTheModel() throws IOException {
        assertEquals(fixture().feature_order(), AnomalyModel.FEATURE_ORDER);
    }

    @Test
    void reproducesEveryFeatureOfTheParityFixture() throws IOException {
        Fixture fixture = fixture();
        List<AnomalyCheckRequest.Reading> readings =
                fixture.rows().stream().map(Row::reading).toList();

        double[][] features = new AnomalyFeatureBuilder().build(readings);

        assertEquals(fixture.rows().size(), features.length, "one feature row per reading");
        for (int i = 0; i < features.length; i++) {
            double[] expected = fixture.rows().get(i).features();
            assertEquals(expected.length, features[i].length, "feature count in row " + i);
            for (int j = 0; j < expected.length; j++) {
                assertEquals(
                        expected[j],
                        features[i][j],
                        TOLERANCE,
                        "row " + i + ", feature " + AnomalyModel.FEATURE_ORDER.get(j));
            }
        }
    }
}
