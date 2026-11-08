package com.proj.server.notification;

import com.proj.server.workorder.WholeNumberDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import tools.jackson.databind.annotation.JsonDeserialize;

@Schema(requiredProperties = {"anomalyScoreThreshold", "serviceLeadDays", "repairLeadDays"})
public record NotificationSettingsRequest(
        @Schema(description = "0.51 to 1.00, at most two decimal places")
        @NotNull
        @DecimalMin("0.51")
        @DecimalMax("1.00")
        @Digits(integer = 1, fraction = 2)
        BigDecimal anomalyScoreThreshold,

        @Schema(description = "Whole days, 0 to 365")
        @NotNull
        @Min(0)
        @Max(365)
        @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer serviceLeadDays,

        @Schema(description = "30, 60 or 90") @NotNull @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer repairLeadDays) {}
