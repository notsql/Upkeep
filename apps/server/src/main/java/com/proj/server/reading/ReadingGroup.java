package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** The readings sharing one measuredAt and one source: a device, or a person recording manually. */
@Schema(requiredProperties = {"measuredAt", "source", "metrics"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReadingGroup(
        @Schema(description = "In UTC") OffsetDateTime measuredAt,
        ReadingSource source,
        @Schema(description = "SENSOR only") UUID deviceId,
        @Schema(description = "SENSOR only") String deviceIdentifier,

        @Schema(description = "MANUAL only, when the recorder had a name")
        String recordedByName,

        @Schema(description = "SENSOR only: the asset's stored anomaly score at measuredAt, when scored")
        Double anomalyScore,

        @Schema(description = "In catalogue order") List<GroupedMetricReading> metrics) {}
