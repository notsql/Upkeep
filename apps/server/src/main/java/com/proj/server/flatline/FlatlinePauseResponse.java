package com.proj.server.flatline;

import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

@Schema(requiredProperties = {"deviceId", "metric", "pausedAt", "resumesAt", "pausedByUserId"})
public record FlatlinePauseResponse(
        UUID deviceId, DeviceMetric metric, Instant pausedAt, Instant resumesAt, String pausedByUserId) {}
