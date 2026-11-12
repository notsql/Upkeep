package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "toStatus", "changedByUserId", "changedAt", "version", "kind", "assigneeName"})
public record WorkOrderStatusEventResponse(
        UUID id,
        WorkOrderStatus fromStatus,
        WorkOrderStatus toStatus,
        String changedByUserId,
        String changedByName,
        OffsetDateTime changedAt,
        int version,
        WorkOrderStatusEventKind kind,

        @Schema(nullable = true, description = "Who the job was given to; set only for ASSIGNED")
        String assigneeName) {}
