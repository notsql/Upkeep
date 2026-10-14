package com.proj.server.anomaly;

import java.util.List;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Component;

/**
 * Builds the model's features, in {@link AnomalyModel#FEATURE_ORDER}, for readings sorted by timestamp: the raw
 * values, then the mean and the sample standard deviation over the last {@link AnomalyModel#WINDOW_ROWS} readings.
 * Windows restart at the start of each batch, as in the training notebook.
 */
@Component
public class AnomalyFeatureBuilder {
    private static final List<ToDoubleFunction<AnomalyCheckRequest.Reading>> INPUTS = List.of(
            AnomalyCheckRequest.Reading::vibrationAcceleration,
            AnomalyCheckRequest.Reading::pressure,
            AnomalyCheckRequest.Reading::temperature,
            AnomalyCheckRequest.Reading::flowRate,
            AnomalyCheckRequest.Reading::power);

    public double[][] build(List<AnomalyCheckRequest.Reading> readings) {
        int inputs = INPUTS.size();
        double[][] values = new double[readings.size()][inputs];
        for (int i = 0; i < readings.size(); i++) {
            for (int j = 0; j < inputs; j++) {
                values[i][j] = INPUTS.get(j).applyAsDouble(readings.get(i));
            }
        }
        double[][] features = new double[readings.size()][inputs * 3];
        for (int i = 0; i < readings.size(); i++) {
            int from = Math.max(0, i - AnomalyModel.WINDOW_ROWS + 1);
            int n = i - from + 1;
            for (int j = 0; j < inputs; j++) {
                double sum = 0;
                for (int r = from; r <= i; r++) {
                    sum += values[r][j];
                }
                double mean = sum / n;
                double squares = 0;
                for (int r = from; r <= i; r++) {
                    double d = values[r][j] - mean;
                    squares += d * d;
                }
                features[i][j] = values[i][j];
                features[i][inputs + j] = mean;
                features[i][2 * inputs + j] = n > 1 ? Math.sqrt(squares / (n - 1)) : 0;
            }
        }
        return features;
    }
}
