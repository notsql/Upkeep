package com.proj.server.notification;

import java.time.LocalDate;
import java.time.ZoneId;

/** Sweeps count Singapore calendar days, the same day as the inspection list. */
final class NotificationDays {
    static final ZoneId SINGAPORE = ZoneId.of("Asia/Singapore");

    private NotificationDays() {}

    static LocalDate today() {
        return LocalDate.now(SINGAPORE);
    }
}
