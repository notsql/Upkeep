package com.proj.server.routing;

import com.proj.server.workorder.WorkOrderStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Where a report is in automatic routing. Staff only; resident responses never carry it. */
@Schema(requiredProperties = {"state", "reason", "classification", "workOrder", "decidedAt"})
public record ReportRoutingResponse(
        RoutingState state,
        @Schema(nullable = true) String reason,
        @Schema(nullable = true) ClassificationResponse classification,
        @Schema(nullable = true) RoutedWorkOrder workOrder,
        @Schema(nullable = true) OffsetDateTime decidedAt) {
    /** The newest classification: the model's answer, or a category a person chose. */
    @Schema(
            requiredProperties = {
                "outcome",
                "equipmentType",
                "category",
                "confidence",
                "reason",
                "manual",
                "classifiedByName",
                "createdAt"
            })
    public record ClassificationResponse(
            ClassificationOutcome outcome,
            @Schema(nullable = true) EquipmentType equipmentType,

            @Schema(nullable = true, description = "Null for reports classified before fault categories")
            FaultCategory category,

            @Schema(minimum = "0", maximum = "1") BigDecimal confidence,
            String reason,

            @Schema(description = "True when a person chose the category")
            boolean manual,

            @Schema(nullable = true, description = "Who chose the category; null for the model or an unknown name")
            String classifiedByName,

            OffsetDateTime createdAt) {}

    /** The ID-36 work order routing created or resolved the review with. */
    @Schema(requiredProperties = {"id", "reference", "status", "dispatch"})
    public record RoutedWorkOrder(
            UUID id,
            String reference,
            WorkOrderStatus status,
            @Schema(nullable = true) WorkOrderDispatchResponse dispatch) {}
}
