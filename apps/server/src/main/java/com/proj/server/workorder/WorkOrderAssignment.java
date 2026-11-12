package com.proj.server.workorder;

import java.util.UUID;
import org.springframework.http.HttpStatus;

/** The rules of assigning a work order (work-order-assignment.md), free of storage so they can be tested alone. */
public final class WorkOrderAssignment {
    public enum Kind {
        MEMBER,
        CONTRACTOR
    }

    /** Who has the order: a member's WorkOS user ID or a contractor's ID, as text. */
    public record Assignee(Kind kind, String id) {
        public static Assignee member(String userId) {
            return new Assignee(Kind.MEMBER, userId);
        }

        public static Assignee contractor(UUID providerId) {
            return new Assignee(Kind.CONTRACTOR, providerId.toString());
        }

        /** The assignee stored on an order row, or null when nobody has it. */
        public static Assignee of(String userId, UUID providerId) {
            if (userId != null) return member(userId);
            return providerId == null ? null : contractor(providerId);
        }
    }

    /** The order's status after the change, and whether nothing changes at all. */
    public record Change(WorkOrderStatus status, boolean noOp) {}

    private WorkOrderAssignment() {}

    /** The requested assignee: exactly one of a member or a contractor. */
    public static Assignee target(String userId, UUID providerId) {
        var user = userId == null || userId.isBlank() ? null : userId.strip();
        if ((user == null) == (providerId == null))
            throw new WorkOrderException(
                    HttpStatus.UNPROCESSABLE_CONTENT, "Choose one team member or one contractor for this job.");
        return user != null ? Assignee.member(user) : Assignee.contractor(providerId);
    }

    public static Change assign(WorkOrderStatus status, Assignee current, Assignee target) {
        requireNotClosed(status);
        if (target.equals(current)) return new Change(status, true);
        return new Change(status == WorkOrderStatus.OPEN ? WorkOrderStatus.ASSIGNED : status, false);
    }

    public static Change unassign(WorkOrderStatus status, Assignee current) {
        requireNotClosed(status);
        if (current == null) return new Change(status, true);
        return new Change(status == WorkOrderStatus.ASSIGNED ? WorkOrderStatus.OPEN : status, false);
    }

    /** True when a pending email to the current contractor should never go, because they no longer have the job. */
    public static boolean supersedes(Assignee current, Assignee next) {
        return current != null && current.kind() == Kind.CONTRACTOR && !current.equals(next);
    }

    /**
     * Whether the caller may start or complete the order: an owner or Manager on any order that is not closed; Crew only
     * on an order they are the assignee of.
     */
    public static boolean canProgress(
            WorkOrderStatus status, boolean manager, String role, String assigneeUserId, String user) {
        if (status == WorkOrderStatus.CLOSED) return false;
        if (manager) return true;
        return "CREW".equals(role) && user != null && user.equals(assigneeUserId);
    }

    private static void requireNotClosed(WorkOrderStatus status) {
        if (status == WorkOrderStatus.CLOSED)
            throw new WorkOrderException(
                    HttpStatus.CONFLICT, "This work order is closed and can no longer be assigned.");
    }
}
