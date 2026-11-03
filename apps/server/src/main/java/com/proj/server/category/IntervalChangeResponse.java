package com.proj.server.category;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(requiredProperties = {"interval", "changedByUserId", "changedByName", "changedAt"})
public record IntervalChangeResponse(
        @Schema(nullable = true, description = "The interval set, or null when it was cleared")
        ServiceInterval interval,

        String changedByUserId,
        @Schema(nullable = true) String changedByName,
        OffsetDateTime changedAt) {}
