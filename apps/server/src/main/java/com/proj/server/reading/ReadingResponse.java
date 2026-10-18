package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "deviceId", "assetId", "metric", "value", "unit", "measuredAt", "receivedAt"})
public record ReadingResponse(
        UUID id,
        UUID deviceId,

        @Schema(description = "The device's asset when the reading arrived")
        UUID assetId,

        DeviceMetric metric,

        @Schema(description = "As stored: rounded to 6 decimal places")
        BigDecimal value,

        String unit,

        @Schema(description = "In UTC") OffsetDateTime measuredAt,

        @Schema(description = "When the server first stored the reading. A retry returns the original time.")
        OffsetDateTime receivedAt) {}
