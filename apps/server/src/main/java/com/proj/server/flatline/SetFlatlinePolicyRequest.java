package com.proj.server.flatline;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import tools.jackson.databind.annotation.JsonDeserialize;

@Schema(requiredProperties = {"durationMinutes", "tolerance"})
public record SetFlatlinePolicyRequest(
        @NotNull @Min(1) @Max(43200) @JsonDeserialize(using = WholeMinutesDeserializer.class)
        Integer durationMinutes,

        @NotNull @DecimalMin("0") @DecimalMax("999999999999.999999") @Digits(integer = 12, fraction = 6)
        BigDecimal tolerance) {}
