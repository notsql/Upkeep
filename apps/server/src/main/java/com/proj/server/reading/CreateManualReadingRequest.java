package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {"assetId", "metric", "value", "unit", "measuredAt", "submissionId"},
        additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
public record CreateManualReadingRequest(
        UUID assetId,
        DeviceMetric metric,

        @Schema(description = "JSON number; rounded half-up to six decimal places, at most twelve integer digits")
        BigDecimal value,

        String unit,

        @Schema(description = "Timestamp with UTC offset; backdating allowed, at most five minutes ahead")
        OffsetDateTime measuredAt,

        @Schema(description = "Reuse for an identical retry; generate a new UUID for an edited submission")
        UUID submissionId) {}
