package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "fromVersion",
            "version",
            "correctionReason",
            "changedByUserId",
            "changedAt",
            "before",
            "after"
        })
public record WorkOrderCompletionRevisionResponse(
        UUID id,
        int fromVersion,
        int version,
        String correctionReason,
        String changedByUserId,
        String changedByName,
        OffsetDateTime changedAt,
        WorkOrderCompletionResponse before,
        WorkOrderCompletionResponse after) {}
