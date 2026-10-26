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
            "status",
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

        @Schema(description = "Derived from last-seen on every read (decision 0027)")
        DeviceStatus status,

        @Schema(nullable = true, description = "When the device's current API key was issued. Null if it has none.")
        OffsetDateTime credentialIssuedAt,

        @Schema(nullable = true, description = "When the device was deactivated. Permanent; null while active.")
        OffsetDateTime deactivatedAt,

        @Schema(nullable = true, description = "The deactivated device this one replaced")
        UUID replacesDeviceId,

        @Schema(nullable = true, description = "The device that replaced this one")
        UUID replacedByDeviceId,

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}
