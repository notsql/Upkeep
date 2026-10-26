package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"documentId", "associationVersion"})
public record DocumentWorkOrderResponse(
        UUID documentId,
        @Schema(nullable = true) UUID workOrderId,
        @Schema(nullable = true) String workOrderReference,
        int associationVersion,
        @Schema(nullable = true) String changedByName,
        @Schema(nullable = true) OffsetDateTime changedAt) {}
