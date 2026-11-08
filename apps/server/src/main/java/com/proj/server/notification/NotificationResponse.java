package com.proj.server.notification;

import com.proj.server.asset.AssetCondition;
import com.proj.server.category.IntervalSource;
import com.proj.server.category.ServiceInterval;
import com.proj.server.risk.FailureRiskBasis;
import com.proj.server.risk.RecommendedTimeframe;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/** One notification as the caller sees it. Exactly one detail object is non-null, matching {@code type}. */
@Schema(
        requiredProperties = {
            "id",
            "type",
            "estateId",
            "estateName",
            "assetId",
            "assetReference",
            "assetName",
            "summary",
            "createdAt",
            "updatedAt",
            "resolvedAt",
            "read",
            "anomaly",
            "serviceDue",
            "repairPredicted"
        })
public record NotificationResponse(
        UUID id,
        NotificationType type,
        UUID estateId,
        String estateName,
        UUID assetId,
        String assetReference,
        String assetName,
        String summary,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        @Schema(nullable = true) OffsetDateTime resolvedAt,
        boolean read,
        Anomaly anomaly,
        ServiceDue serviceDue,
        RepairPredicted repairPredicted) {

    @Schema(
            name = "AnomalyAlertDetails",
            requiredProperties = {
                "condition",
                "medianScore",
                "maxScore",
                "firstDetectedAt",
                "lastDetectedAt",
                "explanation",
                "response",
                "respondedByName",
                "respondedAt",
                "responseReason"
            })
    public record Anomaly(
            AssetCondition condition,
            double medianScore,
            double maxScore,
            OffsetDateTime firstDetectedAt,
            OffsetDateTime lastDetectedAt,
            String explanation,
            AlertResponse response,
            @Schema(nullable = true) String respondedByName,
            @Schema(nullable = true) OffsetDateTime respondedAt,
            @Schema(nullable = true) String responseReason) {}

    @Schema(
            name = "ServiceDueDetails",
            requiredProperties = {"dueOn", "interval", "intervalSource"})
    public record ServiceDue(LocalDate dueOn, ServiceInterval interval, IntervalSource intervalSource) {}

    @Schema(
            name = "RepairPredictedDetails",
            requiredProperties = {"recommendedTimeframe", "probability", "basis", "failuresObserved"})
    public record RepairPredicted(
            RecommendedTimeframe recommendedTimeframe,
            double probability,
            FailureRiskBasis basis,
            int failuresObserved) {}
}
