package com.proj.server.reading;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

/** One flag on a reading. Only the fields for its type are present. */
@Schema(requiredProperties = {"type"})
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReadingFlagResponse(
        ReadingFlagType type,

        @Schema(description = "GAP only: whole seconds since the previous reading of this metric on the asset")
        Long gapSeconds,

        @Schema(description = "OUT_OF_RANGE only: the metric's inclusive minimum")
        Double validMin,

        @Schema(description = "OUT_OF_RANGE only: the metric's inclusive maximum")
        Double validMax) {

    static ReadingFlagResponse gap(long seconds) {
        return new ReadingFlagResponse(ReadingFlagType.GAP, seconds, null, null);
    }

    static ReadingFlagResponse duplicate() {
        return new ReadingFlagResponse(ReadingFlagType.DUPLICATE_TIMESTAMP, null, null, null);
    }

    static ReadingFlagResponse outOfRange(double min, double max) {
        return new ReadingFlagResponse(ReadingFlagType.OUT_OF_RANGE, null, min, max);
    }
}
