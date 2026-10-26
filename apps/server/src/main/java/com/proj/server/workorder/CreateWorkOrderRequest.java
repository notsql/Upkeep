package com.proj.server.workorder;

import jakarta.validation.constraints.*;
import java.util.UUID;

public record CreateWorkOrderRequest(
        @NotBlank @Size(max = 2500) String description,
        @NotNull UUID locationId,
        UUID assetId,
        @NotNull WorkOrderCategory category,
        @NotNull WorkOrderPriority priority,
        @NotNull WorkOrderSource source,
        UUID sourceReportId,
        UUID sourceInspectionId,
        @Size(max = 500) String sourceReference,
        UUID expectedSourceLocationId) {
    public CreateWorkOrderRequest {
        description = description == null ? null : description.trim();
        sourceReference = sourceReference == null ? null : sourceReference.trim();
    }
}
