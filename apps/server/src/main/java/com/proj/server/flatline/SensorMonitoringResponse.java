package com.proj.server.flatline;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "deviceId",
            "assetId",
            "deviceIdentifier",
            "assetName",
            "assetReference",
            "assetLocationPath",
            "deviceLocationPath",
            "metric",
            "unit",
            "state",
            "lastReadingAt",
            "lastValue",
            "thresholdMinutes",
            "tolerance",
            "flatline",
            "pause"
        })
public record SensorMonitoringResponse(
        UUID deviceId,
        UUID assetId,
        String deviceIdentifier,
        String assetName,
        String assetReference,
        String assetLocationPath,
        String deviceLocationPath,
        DeviceMetric metric,
        String unit,
        State state,
        @Schema(nullable = true) Instant lastReadingAt,
        @Schema(nullable = true) BigDecimal lastValue,
        @Schema(nullable = true) Integer thresholdMinutes,
        BigDecimal tolerance,
        @Schema(nullable = true) FlatlineEvidenceResponse flatline,
        @Schema(nullable = true) FlatlinePauseResponse pause) {
    public enum State {
        NOT_CONFIGURED,
        NO_DATA,
        WAITING_FOR_READINGS,
        MONITORING,
        FLATLINED,
        PAUSED
    }
}
