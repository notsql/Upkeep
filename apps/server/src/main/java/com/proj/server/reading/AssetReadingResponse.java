package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** One stored reading as the owner sees it on an asset. */
@Schema(
        requiredProperties = {
            "id",
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
public record AssetReadingResponse(
        UUID id,
        @Schema(description = "In UTC") OffsetDateTime measuredAt,
        DeviceMetric metric,
        String unit,

        @Schema(description = "As stored: rounded to 6 decimal places")
        BigDecimal value,

        @Schema(nullable = true) UUID deviceId,
        @Schema(nullable = true) String deviceIdentifier,

        @Schema(description = "Empty when nothing is suspect")
        List<ReadingFlagResponse> flags,

        ReadingSource source,
        @Schema(nullable = true) String recordedByUserId,
        @Schema(nullable = true) String recordedByName,
        OffsetDateTime recordedAt,

        @Schema(nullable = true, requiredMode = Schema.RequiredMode.NOT_REQUIRED)
        UUID importBatchId,

        @Schema(nullable = true, requiredMode = Schema.RequiredMode.NOT_REQUIRED)
        String sourceLabel) {
    public AssetReadingResponse(
            UUID id,
            OffsetDateTime measuredAt,
            DeviceMetric metric,
            String unit,
            BigDecimal value,
            UUID deviceId,
            String deviceIdentifier,
            List<ReadingFlagResponse> flags,
            ReadingSource source,
            String recordedByUserId,
            String recordedByName,
            OffsetDateTime recordedAt) {
        this(
                id,
                measuredAt,
                metric,
                unit,
                value,
                deviceId,
                deviceIdentifier,
                flags,
                source,
                recordedByUserId,
                recordedByName,
                recordedAt,
                null,
                null);
    }

    @JsonProperty("valueText")
    @Schema(
            description = "Exact stored decimal for display without binary floating-point conversion",
            requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    public String valueText() {
        return value.stripTrailingZeros().toPlainString();
    }
}
