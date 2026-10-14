package com.proj.server.anomaly;

import java.time.Duration;
import java.util.List;

/**
 * Constants copied from ml-research/artifacts/pump-anomaly-platform/metrics.json. They must change together
 * with apps/ml/models/model.onnx.
 */
public final class AnomalyModel {
    public static final List<String> FEATURE_ORDER = List.of(
            "vibrationAcceleration",
            "pressure",
            "temperature",
            "flowRate",
            "power",
            "vibrationAcceleration_mean",
            "pressure_mean",
            "temperature_mean",
            "flowRate_mean",
            "power_mean",
            "vibrationAcceleration_std",
            "pressure_std",
            "temperature_std",
            "flowRate_std",
            "power_std");

    public static final int WINDOW_ROWS = 10;
    public static final double DECISION_THRESHOLD = 0.51;
    public static final double FAULTY_THRESHOLD = 0.98;
    public static final int MIN_ABNORMAL_RUN = 10;

    public static final int MIN_READINGS = 10;
    public static final int MAX_READINGS = 3600;
    public static final Duration MAX_GAP = Duration.ofSeconds(2);

    public static final String SYSTEM_USER_ID = "system:anomaly-model";
    public static final String SYSTEM_NAME = "Anomaly detection";

    private AnomalyModel() {}
}
