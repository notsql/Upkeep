package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"metric", "unit", "validMin", "validMax"})
public record ReadingMetricOption(DeviceMetric metric, String unit, double validMin, double validMax) {}
