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
            "updatedAt",
            "sourceReportConfirmedDuplicateCount",
            "assignee",
            "canProgress"
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
        OffsetDateTime updatedAt,

        @Schema(description = "CONFIRMED duplicates of the source report; 0 without a source report.")
        int sourceReportConfirmedDuplicateCount,

        @Schema(nullable = true, description = "Who has the job; null when nobody does.")
        WorkOrderAssigneeResponse assignee,

        @Schema(description = "Whether the caller may start or complete this order.")
        boolean canProgress) {
    public WorkOrderResponse withCreatorName(String name) {
        return copy(name, canProgress);
    }

    public WorkOrderResponse withCanProgress(boolean value) {
        return copy(createdByName, value);
    }

    private WorkOrderResponse copy(String name, boolean progress) {
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
                updatedAt,
                sourceReportConfirmedDuplicateCount,
                assignee,
                progress);
    }
}
