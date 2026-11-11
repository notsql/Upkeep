package com.proj.server.notification;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.proj.server.notification.NotificationMilestones.Open;
import com.proj.server.notification.NotificationMilestones.Step;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Fixed reminder milestones (spec notification-switches-and-milestone-reminders.md). */
class NotificationMilestonesTests {
    static final LocalDate TODAY = LocalDate.of(2026, 11, 11);
    static final Open OPEN_60 = new Open(UUID.randomUUID(), 60);
    static final Open OPEN_30 = new Open(UUID.randomUUID(), 30);
    static final Open OPEN_UNMARKED = new Open(UUID.randomUUID(), null);

    @ParameterizedTest
    @CsvSource({
        "90, 90", "89, 90", "61, 90", "60, 60", "31, 60", "30, 30", "15, 30", "14, 14", "1, 14", "0, 14", "-5, 14"
    })
    void theServiceMilestoneIsTheNearestOneNotYetPassed(int daysLeft, int milestone) {
        assertEquals(milestone, NotificationMilestones.serviceDue(TODAY.plusDays(daysLeft), TODAY));
    }

    @Test
    void aServiceMoreThan90DaysAwayHasNoMilestone() {
        assertNull(NotificationMilestones.serviceDue(TODAY.plusDays(91), TODAY));
    }

    @Test
    void aNewServiceMilestoneIsRaised() {
        assertEquals(Step.RAISE, NotificationMilestones.serviceStep(null, false, 30, true));
        assertEquals(Step.RAISE, NotificationMilestones.serviceStep(OPEN_60, false, 30, true));
    }

    @Test
    void aServiceMilestoneThatAlreadyFiredForThisDueDateIsNotRepeated() {
        assertEquals(Step.KEEP, NotificationMilestones.serviceStep(null, true, 30, true));
        assertEquals(Step.KEEP, NotificationMilestones.serviceStep(OPEN_30, true, 30, true));
    }

    @Test
    void aSwitchedOffServiceReminderIsNotRaised() {
        assertEquals(Step.KEEP, NotificationMilestones.serviceStep(null, false, 30, false));
        assertEquals(Step.KEEP, NotificationMilestones.serviceStep(OPEN_60, false, 30, false));
    }

    @Test
    void anOpenReminderFromBeforeMilestonesIsMarkedNotResent() {
        assertEquals(Step.BACKFILL, NotificationMilestones.serviceStep(OPEN_UNMARKED, false, 30, true));
        assertEquals(Step.BACKFILL, NotificationMilestones.repairStep(OPEN_UNMARKED, 30, true));
    }

    @Test
    void aNearerRepairWindowIsRaised() {
        assertEquals(Step.RAISE, NotificationMilestones.repairStep(null, 90, true));
        assertEquals(Step.RAISE, NotificationMilestones.repairStep(OPEN_60, 30, true));
    }

    @Test
    void aRepairReminderNeverStepsBackwards() {
        assertEquals(Step.KEEP, NotificationMilestones.repairStep(OPEN_30, 60, true));
        assertEquals(Step.KEEP, NotificationMilestones.repairStep(OPEN_30, 30, true));
    }

    @Test
    void aSwitchedOffRepairReminderIsNotRaised() {
        assertEquals(Step.KEEP, NotificationMilestones.repairStep(null, 30, false));
        assertEquals(Step.KEEP, NotificationMilestones.repairStep(OPEN_60, 30, false));
    }

    @Test
    void theServiceSummaryNamesTheMilestone() {
        var dueOn = LocalDate.of(2026, 12, 12);
        assertEquals("Service due in 30 days (on 12 Dec 2026)", NotificationSweeper.serviceSummary(dueOn, TODAY, 30));
        assertEquals("Service due in 90 days (on 12 Dec 2026)", NotificationSweeper.serviceSummary(dueOn, TODAY, 90));
        assertEquals("Service due on 12 Dec 2026", NotificationSweeper.serviceSummary(dueOn, TODAY, 14));
        assertEquals(
                "Service overdue since 12 Dec 2026",
                NotificationSweeper.serviceSummary(dueOn, LocalDate.of(2026, 12, 13), 14));
    }
}
