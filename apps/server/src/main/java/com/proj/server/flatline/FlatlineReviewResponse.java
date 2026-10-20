package com.proj.server.flatline;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

@Schema(
        requiredProperties = {
            "checkedAt",
            "canManage",
            "estateActive",
            "hasSensorReadings",
            "page",
            "size",
            "totalElements",
            "sensors"
        })
public record FlatlineReviewResponse(
        Instant checkedAt,
        boolean canManage,
        boolean estateActive,
        boolean hasSensorReadings,
        int page,
        int size,
        long totalElements,
        List<SensorMonitoringResponse> sensors) {}
