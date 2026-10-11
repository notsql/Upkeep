package com.proj.server.event;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record AssetEventResponse(
        UUID id,
        UUID assetId,
        AssetEventCategory category,
        AssetEventType type,
        LocalDate occurredOn,
        String notes,
        String assetManufacturer,
        String assetModel,
        boolean countsTowardForecast,
        String recordedByUserId,
        String recordedByName,
        OffsetDateTime createdAt) {}
