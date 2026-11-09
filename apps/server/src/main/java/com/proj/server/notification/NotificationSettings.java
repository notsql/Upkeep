package com.proj.server.notification;

import java.math.BigDecimal;

/** An estate's notification thresholds; {@link #DEFAULTS} when it has saved none. */
public record NotificationSettings(BigDecimal anomalyScoreThreshold, int serviceLeadDays, int repairLeadDays) {
    public static final NotificationSettings DEFAULTS = new NotificationSettings(new BigDecimal("0.51"), 14, 30);
}
