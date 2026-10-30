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

        @Schema(
                types = {"number", "string"},
                description =
                        "Prefer exact decimal text: at most twelve integer and six fractional digits. Legacy JSON numbers retain half-up rounding to six decimal places.")
        BigDecimal value,

        String unit,

        @Schema(description = "Timestamp with UTC offset; backdating allowed, at most five minutes ahead")
        OffsetDateTime measuredAt,

        @Schema(description = "Reuse for an identical retry; generate a new UUID for an edited submission")
        UUID submissionId) {}
