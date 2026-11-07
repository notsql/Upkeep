package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.proj.server.device.DeviceMetric;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "assetId",
            "metric",
            "value",
            "unit",
            "measuredAt",
            "recordedAt",
            "source",
            "recordedByUserId",
            "recordedByName"
        })
public record ManualReadingResponse(
        UUID id,
        UUID assetId,
        DeviceMetric metric,
        BigDecimal value,
        String unit,
        OffsetDateTime measuredAt,
        OffsetDateTime recordedAt,
        ReadingSource source,
        String recordedByUserId,
        @Schema(nullable = true) String recordedByName) {
    @JsonProperty("valueText")
    @Schema(
            description = "Exact stored decimal for display without binary floating-point conversion",
            requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    public String valueText() {
        return value.stripTrailingZeros().toPlainString();
    }
}
