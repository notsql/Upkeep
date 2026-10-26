package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "associationVersion", "changedAt"})
public record DocumentWorkOrderEventResponse(
        UUID id,
        @Schema(nullable = true) UUID fromWorkOrderId,
        @Schema(nullable = true) String fromWorkOrderReference,
        @Schema(nullable = true) UUID toWorkOrderId,
        @Schema(nullable = true) String toWorkOrderReference,
        int associationVersion,
        @Schema(nullable = true) String correctionReason,
        @Schema(nullable = true) String changedByName,
        OffsetDateTime changedAt) {}
