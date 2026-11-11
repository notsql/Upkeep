package com.proj.server.notification;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Fixed reminder milestones (spec notification-switches-and-milestone-reminders.md): service due at 90, 60, 30 and 14
 * days before the due date; expected repair at the forecast's 90, 60 and 30 day windows.
 */
final class NotificationMilestones {
    private static final List<Integer> SERVICE_DUE = List.of(14, 30, 60, 90);

    /** The asset's open reminder of one type; {@code milestoneDays} is null on rows raised before milestones. */
    record Open(UUID id, Integer milestoneDays) {}

    enum Step {
        /** An open reminder from before milestones: mark it with the current milestone, do not resend. */
        BACKFILL,
        /** Nothing new: already sent, not nearer, or switched off. The asset still qualifies. */
        KEEP,
        /** Resolve any open reminder and raise one for the current milestone. */
        RAISE
    }

    private NotificationMilestones() {}

    /** The nearest milestone not yet passed; overdue counts as 14. Null when the service is over 90 days away. */
    static Integer serviceDue(LocalDate dueOn, LocalDate today) {
        var daysLeft = ChronoUnit.DAYS.between(today, dueOn);
        return SERVICE_DUE.stream()
                .filter(milestone -> milestone >= daysLeft)
                .findFirst()
                .orElse(null);
    }

    /** {@code fired}: a reminder (open or resolved) already exists for this asset, due date and milestone. */
    static Step serviceStep(Open open, boolean fired, int milestone, boolean enabled) {
        if (open != null && open.milestoneDays() == null) {
            return Step.BACKFILL;
        }
        return !fired && enabled ? Step.RAISE : Step.KEEP;
    }

    /** A repair reminder only moves nearer while it stays open; one never steps backwards. */
    static Step repairStep(Open open, int milestone, boolean enabled) {
        if (open != null && open.milestoneDays() == null) {
            return Step.BACKFILL;
        }
        var alreadySent = open != null && open.milestoneDays() <= milestone;
        return !alreadySent && enabled ? Step.RAISE : Step.KEEP;
    }
}
