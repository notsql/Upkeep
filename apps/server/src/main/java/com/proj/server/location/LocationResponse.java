package com.proj.server.location;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "type", "name", "createdAt", "updatedAt"})
public record LocationResponse(
        UUID id,
        LocationType type,
        @Schema(nullable = true) UUID parentId,
        String name,

        @Schema(nullable = true, description = "A level's position in its block, lowest first")
        Integer sortOrder,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        @Schema(nullable = true) OffsetDateTime deactivatedAt) {}
