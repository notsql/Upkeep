package com.proj.server.device;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** A {@link DeviceResponse} with the asset it reports for, for the estate's Devices page. */
@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "assetId",
            "assetReference",
            "assetName",
            "assetRetired",
            "locationId",
            "identifier",
            "model",
            "metrics",
            "reportingIntervalSeconds",
            "status",
            "createdAt",
            "updatedAt"
        })
public record EstateDeviceResponse(
        UUID id,
        UUID estateId,
        UUID assetId,
        String assetReference,
        String assetName,
        boolean assetRetired,
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

        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
    static EstateDeviceResponse of(DeviceResponse device, String assetReference, String assetName, boolean retired) {
        return new EstateDeviceResponse(
                device.id(),
                device.estateId(),
                device.assetId(),
                assetReference,
                assetName,
                retired,
                device.locationId(),
                device.identifier(),
                device.model(),
                device.metrics(),
                device.reportingIntervalSeconds(),
                device.lastSeenAt(),
                device.status(),
                device.credentialIssuedAt(),
                device.createdAt(),
                device.updatedAt());
    }
}
