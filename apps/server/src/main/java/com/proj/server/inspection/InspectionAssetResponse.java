package com.proj.server.inspection;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "locationId",
            "reference",
            "name",
            "category",
            "locationPath",
            "installedOn",
            "estateActive",
            "assetActive",
            "locationActive"
        })
public record InspectionAssetResponse(
        UUID id,
        UUID estateId,
        UUID locationId,
        String reference,
        String name,
        String category,
        String locationPath,
        @Schema(nullable = true) LocalDate installedOn,
        boolean estateActive,
        boolean assetActive,
        boolean locationActive) {}
