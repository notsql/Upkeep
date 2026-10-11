package com.proj.server.anomaly;

/** Calls apps/ml {@code POST /predict}. The base URL comes from {@code ML_API_URL}. */
public class MlClient {
    private final String baseUrl;

    public MlClient(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    /** The anomaly probability for each feature row, in order. */
    public double[] scores(double[][] features) {
        throw new UnsupportedOperationException("Not implemented");
    }
}
