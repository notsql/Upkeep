package com.proj.server.anomaly;

import com.proj.server.asset.AssetCondition;

public record AnomalyCheckResponse(
        int readingsScored,
        int abnormalReadings,
        int longestAbnormalRun,
        double maxScore,
        AssetCondition conditionRecorded) {}
