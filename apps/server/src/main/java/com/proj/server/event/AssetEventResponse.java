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
        OffsetDateTime createdAt,
        @Schema(nullable = true) String findings,
        @Schema(nullable = true) String workPerformed,
        @Schema(nullable = true) String serviceProvider,
        @Schema(nullable = true) String partsReplaced,
        @Schema(nullable = true) Integer downtimeMinutes,

        @Schema(nullable = true, description = "SGD, two decimals")
        String labourCost,

        @Schema(nullable = true, description = "SGD, two decimals")
        String partsCost,

        @Schema(nullable = true, description = "SGD, two decimals")
        String otherCost,

        @Schema(nullable = true, description = "SGD, two decimals; null when any cost is unknown")
        String totalCost) {}
