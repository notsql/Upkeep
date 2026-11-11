package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        requiredProperties = {
            "anomalyEnabled",
            "serviceDueEnabled",
            "repairPredictedEnabled",
            "checkRequestedEnabled",
            "checkFailedEnabled"
        })
public record NotificationSettingsResponse(
        boolean anomalyEnabled,
        boolean serviceDueEnabled,
        boolean repairPredictedEnabled,
        boolean checkRequestedEnabled,
        boolean checkFailedEnabled) {

    static NotificationSettingsResponse of(NotificationSettings settings) {
        return new NotificationSettingsResponse(
                settings.anomalyEnabled(),
                settings.serviceDueEnabled(),
                settings.repairPredictedEnabled(),
                settings.checkRequestedEnabled(),
                settings.checkFailedEnabled());
    }
}
