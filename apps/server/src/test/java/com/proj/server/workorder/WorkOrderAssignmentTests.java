package com.proj.server.workorder;

import static com.proj.server.workorder.WorkOrderStatus.ASSIGNED;
import static com.proj.server.workorder.WorkOrderStatus.CLOSED;
import static com.proj.server.workorder.WorkOrderStatus.IN_PROGRESS;
import static com.proj.server.workorder.WorkOrderStatus.OPEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.proj.server.workorder.WorkOrderAssignment.Assignee;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class WorkOrderAssignmentTests {
    private static final UUID ACE = UUID.randomUUID();
    private static final UUID BOLT = UUID.randomUUID();
    private static final Assignee PRIYA = Assignee.member("user_priya");
    private static final Assignee ACE_PLUMBING = Assignee.contractor(ACE);

    @Test
    void aTargetIsExactlyOneOfAMemberOrAContractor() {
        assertEquals(PRIYA, WorkOrderAssignment.target("user_priya", null));
        assertEquals(ACE_PLUMBING, WorkOrderAssignment.target(null, ACE));
        assertEquals(PRIYA, WorkOrderAssignment.target("  user_priya  ", null));

        for (var both : new Object[][] {{"user_priya", ACE}, {null, null}, {"   ", null}}) {
            var error = assertThrows(
                    WorkOrderException.class, () -> WorkOrderAssignment.target((String) both[0], (UUID) both[1]));
            assertEquals(HttpStatus.UNPROCESSABLE_CONTENT, error.status());
        }
    }

    @Test
    void firstAssignmentOfAnOpenOrderMovesItToAssigned() {
        var change = WorkOrderAssignment.assign(OPEN, null, PRIYA);

        assertEquals(ASSIGNED, change.status());
        assertFalse(change.noOp());
    }

    @Test
    void reassigningKeepsAssignedOrInProgress() {
        assertEquals(
                ASSIGNED,
                WorkOrderAssignment.assign(ASSIGNED, PRIYA, ACE_PLUMBING).status());
        assertEquals(
                IN_PROGRESS,
                WorkOrderAssignment.assign(IN_PROGRESS, ACE_PLUMBING, PRIYA).status());
        assertEquals(
                IN_PROGRESS,
                WorkOrderAssignment.assign(IN_PROGRESS, null, PRIYA).status());
    }

    @Test
    void assigningTheCurrentAssigneeAgainIsANoOp() {
        assertTrue(WorkOrderAssignment.assign(ASSIGNED, PRIYA, Assignee.member("user_priya"))
                .noOp());
        assertTrue(WorkOrderAssignment.assign(IN_PROGRESS, ACE_PLUMBING, Assignee.contractor(ACE))
                .noOp());
        assertFalse(WorkOrderAssignment.assign(ASSIGNED, ACE_PLUMBING, Assignee.contractor(BOLT))
                .noOp());
    }

    @Test
    void aClosedOrderCannotBeAssignedOrUnassigned() {
        var assign = assertThrows(WorkOrderException.class, () -> WorkOrderAssignment.assign(CLOSED, null, PRIYA));
        var unassign = assertThrows(WorkOrderException.class, () -> WorkOrderAssignment.unassign(CLOSED, PRIYA));

        assertEquals(HttpStatus.CONFLICT, assign.status());
        assertEquals(HttpStatus.CONFLICT, unassign.status());
    }

    @Test
    void unassigningAnAssignedOrderReopensItButInProgressStaysInProgress() {
        assertEquals(OPEN, WorkOrderAssignment.unassign(ASSIGNED, PRIYA).status());
        assertEquals(
                IN_PROGRESS,
                WorkOrderAssignment.unassign(IN_PROGRESS, ACE_PLUMBING).status());
        assertTrue(WorkOrderAssignment.unassign(OPEN, null).noOp());
    }

    @Test
    void onlyAPendingEmailToAContractorWhoLostTheOrderIsSuperseded() {
        assertTrue(WorkOrderAssignment.supersedes(ACE_PLUMBING, Assignee.contractor(BOLT)));
        assertTrue(WorkOrderAssignment.supersedes(ACE_PLUMBING, PRIYA));
        assertTrue(WorkOrderAssignment.supersedes(ACE_PLUMBING, null));
        assertFalse(WorkOrderAssignment.supersedes(ACE_PLUMBING, Assignee.contractor(ACE)));
        assertFalse(WorkOrderAssignment.supersedes(PRIYA, ACE_PLUMBING));
        assertFalse(WorkOrderAssignment.supersedes(null, ACE_PLUMBING));
    }

    @Test
    void managersMayProgressAnyOpenOrderAndCrewOnlyTheirOwn() {
        assertTrue(WorkOrderAssignment.canProgress(ASSIGNED, true, "MANAGER", null, "user_m"));
        assertTrue(WorkOrderAssignment.canProgress(IN_PROGRESS, true, null, "user_priya", "owner"));
        assertTrue(WorkOrderAssignment.canProgress(ASSIGNED, false, "CREW", "user_priya", "user_priya"));
        assertTrue(WorkOrderAssignment.canProgress(IN_PROGRESS, false, "CREW", "user_priya", "user_priya"));

        assertFalse(WorkOrderAssignment.canProgress(ASSIGNED, false, "CREW", "user_priya", "user_other"));
        assertFalse(WorkOrderAssignment.canProgress(OPEN, false, "CREW", null, "user_priya"));
        assertFalse(WorkOrderAssignment.canProgress(ASSIGNED, false, "RESIDENT", "user_priya", "user_priya"));
        assertFalse(WorkOrderAssignment.canProgress(ASSIGNED, false, null, "user_priya", "user_priya"));
        assertFalse(WorkOrderAssignment.canProgress(CLOSED, true, "MANAGER", null, "user_m"));
        assertFalse(WorkOrderAssignment.canProgress(CLOSED, false, "CREW", "user_priya", "user_priya"));
    }
}
