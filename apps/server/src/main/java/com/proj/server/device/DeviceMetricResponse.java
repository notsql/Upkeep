package com.proj.server.device;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"metric", "unit"})
public record DeviceMetricResponse(DeviceMetric metric, String unit) {}
