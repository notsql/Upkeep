package com.proj.server.anomaly;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OnnxValue;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import java.io.IOException;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Runs the anomaly model (src/main/resources/anomaly/model.onnx) in process with onnxruntime. One session is loaded
 * at startup and shared by every request; {@link OrtSession#run} is thread-safe.
 */
@Component
public class AnomalyScorer implements AutoCloseable {
    static final String MODEL_RESOURCE = "/anomaly/model.onnx";

    /** The ONNX model's input name (metrics.json {@code onnx_input.name}), float32 of shape [n, 15]. */
    private static final String INPUT_NAME = "input";

    /** float32 of shape [n, 2]; column 1 is the anomaly probability. */
    private static final String OUTPUT_NAME = "probabilities";

    private final OrtEnvironment env;
    private final OrtSession session;

    public AnomalyScorer() {
        this(MODEL_RESOURCE);
    }

    AnomalyScorer(String resource) {
        byte[] model;
        try (InputStream in = AnomalyScorer.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing anomaly model resource " + resource);
            }
            model = in.readAllBytes();
        } catch (IOException error) {
            throw new IllegalStateException("Could not read anomaly model resource " + resource, error);
        }
        this.env = OrtEnvironment.getEnvironment();
        try {
            this.session = env.createSession(model);
        } catch (OrtException error) {
            throw new IllegalStateException("Could not load anomaly model " + resource, error);
        }
    }

    /** The anomaly probability for each feature row, in order. */
    public double[] scores(double[][] features) {
        int columns = features.length == 0 ? AnomalyModel.FEATURE_ORDER.size() : features[0].length;
        FloatBuffer buffer = FloatBuffer.allocate(features.length * columns);
        for (double[] row : features) {
            if (row.length != columns) {
                throw new MlUnavailableException("The anomaly model received rows of different lengths.", null);
            }
            for (double value : row) {
                // Narrowed as numpy's asarray(..., float32) does: round to nearest.
                buffer.put((float) value);
            }
        }
        buffer.rewind();

        float[][] probabilities;
        try (OnnxTensor input = OnnxTensor.createTensor(env, buffer, new long[] {features.length, columns});
                OrtSession.Result result = session.run(Map.of(INPUT_NAME, input))) {
            Optional<OnnxValue> output = result.get(OUTPUT_NAME);
            if (output.isEmpty() || !(output.get().getValue() instanceof float[][] values)) {
                throw new MlUnavailableException("The anomaly model returned an unexpected output.", null);
            }
            probabilities = values;
        } catch (OrtException error) {
            throw new MlUnavailableException("The anomaly model failed. Try the batch again later.", error);
        }
        return anomalyColumn(probabilities, features.length);
    }

    /** Column 1 of each {@code probabilities} row, or {@link MlUnavailableException} if the row count is wrong. */
    static double[] anomalyColumn(float[][] probabilities, int rows) {
        if (probabilities.length != rows) {
            throw new MlUnavailableException("The anomaly model returned an unexpected number of scores.", null);
        }
        double[] scores = new double[rows];
        for (int i = 0; i < rows; i++) {
            if (probabilities[i].length < 2) {
                throw new MlUnavailableException("The anomaly model returned an unexpected output.", null);
            }
            scores[i] = probabilities[i][1];
        }
        return scores;
    }

    @Override
    public void close() throws OrtException {
        session.close();
    }
}
