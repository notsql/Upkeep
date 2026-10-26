package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "reference",
            "description",
            "locationId",
            "locationPath",
            "category",
            "priority",
            "source",
            "status",
            "version",
            "createdByUserId",
            "createdAt",
            "updatedAt"
        })
public record WorkOrderResponse(
        UUID id,
        UUID estateId,
        String reference,
        String description,
        UUID locationId,
        String locationPath,
        UUID assetId,
        String assetReference,
        WorkOrderCategory category,
        WorkOrderPriority priority,
        WorkOrderSource source,
        UUID sourceReportId,
        @Schema(nullable = true) UUID sourceInspectionId,
        String sourceReference,
        WorkOrderStatus status,
        int version,
        WorkOrderCompletionResponse completion,
        String createdByUserId,

        @Schema(description = "Current creator display name on creation/detail responses; null when unavailable.")
        String createdByName,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
    public WorkOrderResponse withCreatorName(String name) {
        return new WorkOrderResponse(
                id,
                estateId,
                reference,
                description,
                locationId,
                locationPath,
                assetId,
                assetReference,
                category,
                priority,
                source,
                sourceReportId,
                sourceInspectionId,
                sourceReference,
                status,
                version,
                completion,
                createdByUserId,
                name,
                createdAt,
                updatedAt);
    }
}
