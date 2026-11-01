package com.proj.server.category;

import com.proj.server.workorder.WholeNumberDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.annotation.JsonDeserialize;

/** A service interval as entered: 14 days, 6 months, 2 years. Never converted between units. */
@Schema(requiredProperties = {"value", "unit"})
public record ServiceInterval(
        @Schema(description = "1-3650 days, 1-120 months or 1-10 years")
        @NotNull
        @Min(1)
        @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer value,

        @NotNull IntervalUnit unit) {

    /** The stored columns as an interval; null when cleared. */
    static ServiceInterval of(Integer value, String unit) {
        return value == null || unit == null ? null : new ServiceInterval(value, IntervalUnit.valueOf(unit));
    }

    /** The request's interval, refused when its value is over the unit's limit. */
    static ServiceInterval checked(SetServiceIntervalRequest request) {
        var interval = request.interval();
        if (interval != null && interval.value() > interval.unit().max()) {
            throw new AssetCategoryException(
                    HttpStatus.BAD_REQUEST,
                    "interval.value: must be from 1 to " + interval.unit().max() + " for " + interval.unit() + ".");
        }
        return interval;
    }
}
