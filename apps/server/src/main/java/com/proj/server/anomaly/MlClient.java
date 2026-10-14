package com.proj.server.anomaly;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Calls apps/ml {@code POST /predict}. The base URL comes from {@code ML_API_URL}. */
@Component
public class MlClient {
    static final Duration TIMEOUT = Duration.ofSeconds(5);

    /** The ONNX model's input name (metrics.json {@code onnx_input.name}). */
    private static final String INPUT_NAME = "input";

    private final RestClient client;

    public MlClient(@Value("${ML_API_URL:http://localhost:8000}") String baseUrl) {
        var http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
        var requestFactory = new JdkClientHttpRequestFactory(http);
        requestFactory.setReadTimeout(TIMEOUT);
        this.client = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    record PredictRequest(Map<String, double[][]> inputs) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record PredictResponse(Outputs outputs) {}

    /** {@code probabilities} is [n, 2]; column 1 is the anomaly probability. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Outputs(double[][] probabilities) {}

    /** The anomaly probability for each feature row, in order. */
    public double[] scores(double[][] features) {
        PredictResponse response;
        try {
            response = client.post()
                    .uri("/predict")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new PredictRequest(Map.of(INPUT_NAME, features)))
                    .retrieve()
                    .body(PredictResponse.class);
        } catch (RestClientException error) {
            throw new MlUnavailableException("The anomaly model is unavailable. Try the batch again later.", error);
        }
        if (response == null
                || response.outputs() == null
                || response.outputs().probabilities() == null
                || response.outputs().probabilities().length != features.length) {
            throw new MlUnavailableException("The anomaly model returned an unexpected response.", null);
        }
        double[] scores = new double[features.length];
        for (int i = 0; i < scores.length; i++) {
            scores[i] = response.outputs().probabilities()[i][1];
        }
        return scores;
    }
}
