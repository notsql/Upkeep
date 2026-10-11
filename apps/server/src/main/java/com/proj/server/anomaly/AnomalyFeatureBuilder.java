package com.proj.server.anomaly;

import java.util.List;

/** Builds the model's features, in {@link AnomalyModel#FEATURE_ORDER}, for readings sorted by timestamp. */
public class AnomalyFeatureBuilder {

    public double[][] build(List<AnomalyCheckRequest.Reading> readings) {
        throw new UnsupportedOperationException("Not implemented");
    }
}
