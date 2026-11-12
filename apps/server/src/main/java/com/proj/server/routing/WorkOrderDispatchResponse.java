package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/** The newest contractor email for a work order. */
@Schema(
        requiredProperties = {
            "equipmentType",
            "contractorName",
            "contractorEmail",
            "approval",
            "status",
            "sentAt",
            "createdAt"
        })
public record WorkOrderDispatchResponse(
        @Schema(nullable = true, description = "Null for a job that is not about a piece of equipment")
        EquipmentType equipmentType,

        String contractorName,
        String contractorEmail,
        Approval approval,
        DispatchStatus status,
        @Schema(nullable = true) OffsetDateTime sentAt,
        OffsetDateTime createdAt) {
    /** Whether the system sent the work order on its own or a Manager approved it. */
    public enum Approval {
        AUTOMATIC,
        MANAGER
    }
}
