package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "type", "name", "parentId", "sortOrder"})
public record ResidentLocationResponse(
        UUID id,
        String type,
        String name,
        @Schema(nullable = true) UUID parentId,
        @Schema(nullable = true) Integer sortOrder) {}
