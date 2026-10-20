package com.proj.server.flatline;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(requiredProperties = {"metric", "unit", "durationMinutes", "tolerance"})
public record FlatlinePolicyResponse(
        DeviceMetric metric,
        String unit,
        @Schema(nullable = true) Integer durationMinutes,
        BigDecimal tolerance) {}
