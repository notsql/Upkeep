package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(
        requiredProperties = {
            "anomalyEnabled",
            "serviceDueEnabled",
            "repairPredictedEnabled",
            "checkRequestedEnabled",
            "checkFailedEnabled"
        })
public record NotificationSettingsRequest(
        @NotNull Boolean anomalyEnabled,
        @NotNull Boolean serviceDueEnabled,
        @NotNull Boolean repairPredictedEnabled,
        @NotNull Boolean checkRequestedEnabled,
        @NotNull Boolean checkFailedEnabled) {

    NotificationSettings settings() {
        return new NotificationSettings(
                anomalyEnabled, serviceDueEnabled, repairPredictedEnabled, checkRequestedEnabled, checkFailedEnabled);
    }
}
