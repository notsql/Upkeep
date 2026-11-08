package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(requiredProperties = {"anomalyScoreThreshold", "serviceLeadDays", "repairLeadDays"})
public record NotificationSettingsResponse(
        BigDecimal anomalyScoreThreshold,
        int serviceLeadDays,
        @Schema(description = "30, 60 or 90") int repairLeadDays) {

    static NotificationSettingsResponse of(NotificationSettings settings) {
        return new NotificationSettingsResponse(
                settings.anomalyScoreThreshold(), settings.serviceLeadDays(), settings.repairLeadDays());
    }
}
