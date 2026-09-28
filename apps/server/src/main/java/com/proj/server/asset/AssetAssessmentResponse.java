package com.proj.server.asset;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "assetId", "condition", "assessedOn", "notes", "recordedByUserId", "recordedAt"})
public record AssetAssessmentResponse(
        UUID id,
        UUID assetId,
        AssetCondition condition,
        LocalDate assessedOn,
        String notes,
        String recordedByUserId,

        @Schema(
                nullable = true,
                description = "The recorder's name when they recorded it. Null if WorkOS was unavailable.")
        String recordedByName,

        OffsetDateTime recordedAt) {}
