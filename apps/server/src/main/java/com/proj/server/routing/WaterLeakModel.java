package com.proj.server.routing;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Runs the water leak model in process (decision 0048). The model, tokenizer and {@link #VERSION} come from
 * ml-research notebook 05 and must change together, with the parity fixture.
 */
@Component
public class WaterLeakModel implements AutoCloseable {
    public static final String VERSION = "water-leak-minilm-v1";

    private static final String MODEL_RESOURCE = "/routing/water-leak-model.onnx";
    private static final String TOKENIZER_RESOURCE = "/routing/water-leak-tokenizer.json";
    private static final String OUTPUT_NAME = "probabilities";
    private static final int NOT_LEAK_COLUMN = 0;
    private static final int LEAK_COLUMN = 1;

    /** Calibrated probabilities for one report. */
    public record Prediction(double notLeak, double leak) {}

    private final OrtEnvironment env = OrtEnvironment.getEnvironment();
    private final OrtSession session;
    private final HuggingFaceTokenizer tokenizer;

    public WaterLeakModel() {
        try (InputStream model = resource(MODEL_RESOURCE);
                InputStream vocabulary = resource(TOKENIZER_RESOURCE)) {
            this.session = env.createSession(model.readAllBytes());
            this.tokenizer = HuggingFaceTokenizer.newInstance(vocabulary, Map.of());
        } catch (IOException | OrtException error) {
            throw new IllegalStateException("Could not load the water leak model.", error);
        }
    }

    private static InputStream resource(String name) {
        var stream = WaterLeakModel.class.getResourceAsStream(name);
        if (stream == null) throw new IllegalStateException("Missing resource " + name);
        return stream;
    }

    long[] tokenIds(String text) {
        return tokenizer.encode(text).getIds();
    }

    /** @throws ClassificationFailedException when the model cannot produce an answer */
    public Prediction predict(String text) {
        Encoding encoding = tokenizer.encode(text);
        try (var inputIds = OnnxTensor.createTensor(env, new long[][] {encoding.getIds()});
                var attentionMask = OnnxTensor.createTensor(env, new long[][] {encoding.getAttentionMask()});
                var tokenTypeIds = OnnxTensor.createTensor(env, new long[][] {encoding.getTypeIds()});
                var result = session.run(Map.of(
                        "input_ids", inputIds, "attention_mask", attentionMask, "token_type_ids", tokenTypeIds))) {
            var output = result.get(OUTPUT_NAME);
            if (output.isEmpty() || !(output.get().getValue() instanceof float[][] rows))
                throw new ClassificationFailedException("The water leak model returned an unexpected output.");
            return new Prediction(rows[0][NOT_LEAK_COLUMN], rows[0][LEAK_COLUMN]);
        } catch (OrtException error) {
            throw new ClassificationFailedException("The water leak model failed.", error);
        }
    }

    @Override
    public void close() {
        tokenizer.close();
        try {
            session.close();
        } catch (OrtException error) {
            throw new IllegalStateException("Could not close the water leak model.", error);
        }
    }
}
