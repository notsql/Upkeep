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
    /** The latest valid answer from the model. */
    @Schema(requiredProperties = {"outcome", "equipmentType", "confidence", "reason", "createdAt"})
    public record ClassificationResponse(
            ClassificationOutcome outcome,
            @Schema(nullable = true) EquipmentType equipmentType,
            @Schema(minimum = "0", maximum = "1") BigDecimal confidence,
            String reason,
            OffsetDateTime createdAt) {}

    /** The ID-36 work order routing created or resolved the review with. */
    @Schema(requiredProperties = {"id", "reference", "status", "dispatch"})
    public record RoutedWorkOrder(
            UUID id,
            String reference,
            WorkOrderStatus status,
            @Schema(nullable = true) WorkOrderDispatchResponse dispatch) {}
}
