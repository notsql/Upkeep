package com.proj.server.category;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(requiredProperties = {"failsSilently", "changedByUserId", "changedByName", "changedAt"})
public record FlagChangeResponse(
        boolean failsSilently,
        String changedByUserId,
        @Schema(nullable = true) String changedByName,
        OffsetDateTime changedAt) {}
