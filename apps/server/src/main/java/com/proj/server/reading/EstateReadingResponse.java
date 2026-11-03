package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "assetId",
            "assetReference",
            "assetName",
            "measuredAt",
            "metric",
            "unit",
            "value",
            "deviceId",
            "deviceIdentifier",
            "flags",
            "source",
            "recordedByUserId",
            "recordedByName",
            "recordedAt"
        })
public record EstateReadingResponse(
        UUID id,
        UUID assetId,
        String assetReference,
        String assetName,
        @Schema(description = "In UTC") OffsetDateTime measuredAt,
        DeviceMetric metric,
        String unit,
        BigDecimal value,
        @Schema(nullable = true) UUID deviceId,
        @Schema(nullable = true) String deviceIdentifier,
        List<ReadingFlagResponse> flags,
        ReadingSource source,
        @Schema(nullable = true) String recordedByUserId,
        @Schema(nullable = true) String recordedByName,
        OffsetDateTime recordedAt) {
    @JsonProperty("valueText")
    @Schema(
            description = "Exact stored decimal for display without binary floating-point conversion",
            requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    public String valueText() {
        return value.stripTrailingZeros().toPlainString();
    }
}
