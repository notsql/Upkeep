package com.proj.server.device;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "assetId",
            "locationId",
            "identifier",
            "model",
            "metrics",
            "reportingIntervalSeconds",
            "createdAt",
            "updatedAt"
        })
public record DeviceResponse(
        UUID id,
        UUID estateId,
        UUID assetId,
        UUID locationId,
        String identifier,
        String model,
        List<DeviceMetricResponse> metrics,
        int reportingIntervalSeconds,

        @Schema(nullable = true, description = "When the device last sent a valid reading. Null until its first.")
        OffsetDateTime lastSeenAt,

        @Schema(nullable = true, description = "When the device's current API key was issued. Null if it has none.")
        OffsetDateTime credentialIssuedAt,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}
