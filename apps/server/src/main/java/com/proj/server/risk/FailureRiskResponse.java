package com.proj.server.risk;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record FailureRiskResponse(
        UUID assetId,
        String assetReference,
        String assetName,
        String category,
        FailureRiskBasis basis,
        int failuresObserved,
        Integer daysSinceLastEvent,
        Double probability30Days,
        Double probability60Days,
        Double probability90Days,
        RecommendedTimeframe recommendedTimeframe,
        LocalDate expectedEndOfLife,
        boolean flagged,
        List<FailureRiskFlagReason> flagReasons) {}
