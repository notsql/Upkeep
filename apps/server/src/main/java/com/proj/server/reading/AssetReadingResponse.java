package com.proj.server.reading;

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
        OffsetDateTime recordedAt) {}
