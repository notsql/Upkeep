package com.proj.server.risk;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "assetId",
            "assetReference",
            "assetName",
            "category",
            "basis",
            "failuresObserved",
            "flagged",
            "flagReasons"
        })
public record FailureRiskResponse(
        UUID assetId,
        String assetReference,
        String assetName,
        String category,
        FailureRiskBasis basis,
        int failuresObserved,
        @Schema(nullable = true) Integer daysSinceLastEvent,
        @Schema(nullable = true) Double probability30Days,
        @Schema(nullable = true) Double probability60Days,
        @Schema(nullable = true) Double probability90Days,
        @Schema(nullable = true) RecommendedTimeframe recommendedTimeframe,
        @Schema(nullable = true) LocalDate expectedEndOfLife,
        boolean flagged,
        List<FailureRiskFlagReason> flagReasons) {}
