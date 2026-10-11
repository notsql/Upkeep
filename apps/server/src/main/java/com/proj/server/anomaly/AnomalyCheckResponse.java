package com.proj.server.anomaly;

import com.proj.server.asset.AssetCondition;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"readingsScored", "abnormalReadings", "longestAbnormalRun", "maxScore"})
public record AnomalyCheckResponse(
        int readingsScored,
        int abnormalReadings,
        int longestAbnormalRun,
        double maxScore,

        @Schema(nullable = true, description = "The condition recorded for the longest abnormal run, or null")
        AssetCondition conditionRecorded) {}
