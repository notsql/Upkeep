package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(requiredProperties = {"readingId", "metric", "value", "unit", "flags"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GroupedMetricReading(
        UUID readingId,
        DeviceMetric metric,
        double value,

        @Schema(description = "MANUAL only: the exact stored decimal")
        String valueText,

        String unit,

        @Schema(description = "Empty when nothing is suspect")
        List<ReadingFlagResponse> flags) {}
