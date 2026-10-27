package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

/** The contractor email for a work order and the provider it was assigned to. */
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
