package com.proj.server.asset;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "reference",
            "name",
            "category",
            "locationId",
            "locationPath",
            "createdAt",
            "updatedAt"
        })
public record AssetResponse(
        UUID id,
        UUID estateId,
        String reference,
        String name,
        AssetCategory category,
        UUID locationId,

        @Schema(description = "The location's names from its block down, e.g. \"Blk 101 › Level 1 › Lift lobby\"")
        String locationPath,

        @Schema(nullable = true) LocalDate installedOn,
        @Schema(nullable = true) String manufacturer,
        @Schema(nullable = true) String model,
        @Schema(nullable = true) String serialNumber,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        @Schema(nullable = true) OffsetDateTime deactivatedAt) {}
