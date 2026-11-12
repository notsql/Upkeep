package com.proj.server.routing;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import ai.onnxruntime.TensorInfo;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Runs the fault category model in process: TF-IDF and logistic regression exported to ONNX, reading text only. The
 * model and {@link #VERSION} come from ml-research/artifacts/fault-category-tfidf and must change together, with the
 * parity fixture. Loaded once at startup; a model that cannot load stops the application.
 */
@Component
public class FaultCategoryModel implements AutoCloseable {
    public static final String VERSION = "fault-category-tfidf-v1";

    private static final String MODEL_RESOURCE = "/routing/fault-category-model.onnx";
    private static final String INPUT_NAME = "text";
    private static final String OUTPUT_NAME = "probabilities";

    private final OrtEnvironment env = OrtEnvironment.getEnvironment();
    private final OrtSession session;
    private final long[] inputShape;

    public FaultCategoryModel() {
        try (InputStream model = FaultCategoryModel.class.getResourceAsStream(MODEL_RESOURCE)) {
            if (model == null) throw new IllegalStateException("Missing resource " + MODEL_RESOURCE);
            this.session = env.createSession(model.readAllBytes());
            var input = session.getInputInfo().get(INPUT_NAME);
            if (input == null || !(input.getInfo() instanceof TensorInfo tensor))
                throw new IllegalStateException("The fault category model has no text input.");
            // One report per call: [1, 1] when the model expects a column, [1] when it expects a vector.
            this.inputShape = tensor.getShape().length == 2 ? new long[] {1, 1} : new long[] {1};
        } catch (IOException | OrtException error) {
            throw new IllegalStateException("Could not load the fault category model.", error);
        }
    }

    /**
     * Calibrated probabilities, one per {@link FaultCategory} in declaration order.
     *
     * @throws ClassificationFailedException when the model cannot produce an answer
     */
    public double[] predict(String text) {
        try (var input = OnnxTensor.createTensor(env, new String[] {passable(text)}, inputShape);
                var result = session.run(Map.of(INPUT_NAME, input))) {
            var output = result.get(OUTPUT_NAME);
            if (output.isEmpty() || !(output.get().getValue() instanceof float[][] rows) || rows.length != 1)
                throw new ClassificationFailedException("The fault category model returned an unexpected output.");
            var probabilities = new double[rows[0].length];
            for (int i = 0; i < probabilities.length; i++) probabilities[i] = rows[0][i];
            return probabilities;
        } catch (OrtException error) {
            throw new ClassificationFailedException("The fault category model failed.", error);
        }
    }

    /**
     * onnxruntime's Java binding hands strings to the model as modified UTF-8, which the model rejects for characters
     * outside the Basic Multilingual Plane (emoji) and for NUL. Neither can be part of a TF-IDF token, so each becomes
     * a space, which separates tokens exactly as the character did in training.
     */
    static String passable(String text) {
        var out = new StringBuilder(text.length());
        text.codePoints().forEach(point -> {
            if (point == 0 || Character.isSupplementaryCodePoint(point)) out.append(' ');
            else out.appendCodePoint(point);
        });
        return out.toString();
    }

    @Override
    public void close() {
        try {
            session.close();
        } catch (OrtException error) {
            throw new IllegalStateException("Could not close the fault category model.", error);
        }
    }
}
