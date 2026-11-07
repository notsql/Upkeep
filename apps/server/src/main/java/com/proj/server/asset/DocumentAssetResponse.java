package com.proj.server.asset;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {"documentId", "assetId", "assetReference", "assetName", "associationVersion", "changedAt"
        })
public record DocumentAssetResponse(
        UUID documentId,
        @Schema(nullable = true) UUID assetId,
        @Schema(nullable = true) String assetReference,
        @Schema(nullable = true) String assetName,
        int associationVersion,
        @Schema(nullable = true) OffsetDateTime changedAt) {}
