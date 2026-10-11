package com.proj.server.asset;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "action", "occurredAt", "actorUserId", "lifecycleVersion"})
public record AssetLifecycleEventResponse(
        UUID id,
        String action,
        OffsetDateTime occurredAt,
        String actorUserId,
        @Schema(nullable = true) OffsetDateTime previousDeactivatedAt,
        @Schema(nullable = true) LocalDate previousRetiredOn,
        @Schema(nullable = true) String previousRetirementReason,
        @Schema(nullable = true) OffsetDateTime deactivatedAt,
        @Schema(nullable = true) LocalDate retiredOn,
        @Schema(nullable = true) String retirementReason,
        int lifecycleVersion) {}
