package com.proj.server.risk;

import java.time.LocalDate;

public record Forecast(
        FailureRiskBasis basis,
        int failuresObserved,
        Integer daysSinceLastEvent,
        Double probability30Days,
        Double probability60Days,
        Double probability90Days,
        RecommendedTimeframe recommendedTimeframe,
        LocalDate expectedEndOfLife,
        boolean nearingEndOfLife) {}
