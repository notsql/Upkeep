package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * One reading as a device sends it. The body is not bound by Jackson:
 * {@link ReadingValidator} reads it strictly (no unknown fields, no strings
 * coerced to numbers) and returns this, with the value rounded to 6 decimal
 * places and {@code measuredAt} in UTC (decision 0028).
 */
@Schema(
        requiredProperties = {"metric", "value", "unit", "measuredAt"},
        additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
public record CreateReadingRequest(
        DeviceMetric metric,

        @Schema(
                description = "A JSON number, at most 12 digits before the decimal point. Rounded half-up to 6"
                        + " decimal places. Strings are not converted.",
                example = "21.5")
        BigDecimal value,

        @Schema(description = "Exactly the catalogue unit for the metric", example = "°C")
        String unit,

        @Schema(
                description = "ISO-8601 with a UTC offset, at most 5 minutes after the server's time",
                example = "2026-10-17T14:30:00+08:00")
        OffsetDateTime measuredAt) {}
