package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;

@Schema(requiredProperties = {"start", "min", "max", "avg", "count"})
public record SeriesPoint(
        @Schema(description = "Bucket start; may be before the requested from")
        OffsetDateTime start,

        double min,
        double max,
        double avg,
        int count) {}
