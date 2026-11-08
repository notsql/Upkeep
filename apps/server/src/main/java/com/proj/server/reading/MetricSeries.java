package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"metric", "unit", "points"})
public record MetricSeries(
        DeviceMetric metric,
        String unit,

        @Schema(description = "Non-empty buckets only, ascending")
        List<SeriesPoint> points) {}
