package com.proj.server.notification;

/** An estate's on/off switch per notification type; {@link #DEFAULTS} (all on) when it has saved none. */
public record NotificationSettings(
        boolean anomalyEnabled,
        boolean serviceDueEnabled,
        boolean repairPredictedEnabled,
        boolean checkRequestedEnabled,
        boolean checkFailedEnabled,
        boolean workOrderAssignedEnabled) {
    public static final NotificationSettings DEFAULTS = new NotificationSettings(true, true, true, true, true, true);
}
