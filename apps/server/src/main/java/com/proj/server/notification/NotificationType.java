package com.proj.server.notification;

/** What a notification is about (spec notifications.md, "Notification types"). */
public enum NotificationType {
    ANOMALY,
    SERVICE_DUE,
    REPAIR_PREDICTED,
    /** A manager sent one person to inspect; only that person sees it. */
    CHECK_REQUESTED,
    /** An inspection was recorded as Fail. */
    CHECK_FAILED
}
