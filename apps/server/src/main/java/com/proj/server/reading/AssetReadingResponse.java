package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** One stored reading as the owner sees it on an asset. */
@Schema(requiredProperties = {"id", "measuredAt", "metric", "unit", "value", "deviceId", "deviceIdentifier"})
public record AssetReadingResponse(
        UUID id,
        @Schema(description = "In UTC") OffsetDateTime measuredAt,
        DeviceMetric metric,
        String unit,

        @Schema(description = "As stored: rounded to 6 decimal places")
        BigDecimal value,

        UUID deviceId,
        String deviceIdentifier) {}
