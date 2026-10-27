package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "assetId",
            "assetReference",
            "assetName",
            "measuredAt",
            "metric",
            "unit",
            "value",
            "deviceId",
            "deviceIdentifier",
            "flags"
        })
public record EstateReadingResponse(
        UUID id,
        UUID assetId,
        String assetReference,
        String assetName,
        @Schema(description = "In UTC") OffsetDateTime measuredAt,
        DeviceMetric metric,
        String unit,
        BigDecimal value,
        UUID deviceId,
        String deviceIdentifier,
        List<ReadingFlagResponse> flags) {}
