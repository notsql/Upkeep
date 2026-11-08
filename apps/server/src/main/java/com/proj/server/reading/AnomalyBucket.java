package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(requiredProperties = {"start", "maxScore", "abnormalCount"})
public record AnomalyBucket(
        OffsetDateTime start,
        double maxScore,

        @Schema(description = "Scores in the bucket at or above anomalyThreshold")
        int abnormalCount) {}
