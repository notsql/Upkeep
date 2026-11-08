package com.proj.server.cost;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/** The projected maintenance cost of the next 12 months (ID-33). Amounts are SGD two-decimal strings. */
@Schema(requiredProperties = {"from", "to", "total", "scheduledServices", "predictedRepairs", "assetsWithoutCostBasis"})
public record BudgetForecastResponse(
        LocalDate from,
        @Schema(description = "Exclusive") LocalDate to,
        String total,
        ScheduledServices scheduledServices,
        PredictedRepairs predictedRepairs,

        @Schema(description = "Assets with a service or repair to project but no cost history to price it")
        int assetsWithoutCostBasis) {

    @Schema(
            name = "ScheduledServicesForecast",
            requiredProperties = {"total", "services"})
    public record ScheduledServices(String total, int services) {}

    @Schema(
            name = "PredictedRepairsForecast",
            requiredProperties = {"total", "expectedRepairs"})
    public record PredictedRepairs(
            String total,

            @Schema(description = "Sum of 365-day breakdown probabilities, two decimals")
            double expectedRepairs) {}
}
