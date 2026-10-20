package com.proj.server.flatline;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.annotation.JsonDeserialize;

@Schema(requiredProperties = {"durationMinutes"})
public record CreateFlatlinePauseRequest(
        @NotNull @Min(1) @Max(10080) @JsonDeserialize(using = WholeMinutesDeserializer.class)
        Integer durationMinutes) {
    @JsonAnySetter
    public void rejectUnknown(String field, Object value) {
        throw new IllegalArgumentException("Unknown maintenance pause field: " + field);
    }
}
