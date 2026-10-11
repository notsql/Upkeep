package com.proj.server.event;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "assetId",
            "category",
            "type",
            "occurredOn",
            "notes",
            "countsTowardForecast",
            "recordedByUserId",
            "createdAt"
        })
public record AssetEventResponse(
        UUID id,
        UUID assetId,
        AssetEventCategory category,
        AssetEventType type,
        LocalDate occurredOn,
        String notes,
        @Schema(nullable = true) String assetManufacturer,
        @Schema(nullable = true) String assetModel,
        boolean countsTowardForecast,
        String recordedByUserId,
        @Schema(nullable = true) String recordedByName,
        OffsetDateTime createdAt) {}
