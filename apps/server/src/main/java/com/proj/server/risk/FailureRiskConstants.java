package com.proj.server.risk;

import com.proj.server.catalogue.AssetCategoryCodes;
import java.util.Set;

public final class FailureRiskConstants {
    public static final double RISK_THRESHOLD = 0.15;
    public static final Set<String> SILENT_FAILURE_CATEGORIES = Set.of(AssetCategoryCodes.PUMP);

    private FailureRiskConstants() {}
}
