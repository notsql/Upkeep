package com.proj.server.workorder;

import com.proj.server.notification.WorkOrderNotifications;
import com.proj.server.routing.EquipmentType;
import com.proj.server.routing.RoutingRepository;
import com.proj.server.workorder.WorkOrderAssignment.Assignee;
import com.proj.server.workorder.WorkOrderAssignment.Kind;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Gives a work order to a team member or a contractor (work-order-assignment.md). Every path - the Assign control,
 * automatic routing and "Send to contractor" - goes through {@link #apply}.
 */
@Service
public class WorkOrderAssignmentService {
    private static final String TEAM_MEMBER = "A team member";

    private final WorkOrderRepository repository;
    private final WorkOrderService orders;
    private final RoutingRepository routing;
    private final WorkOrderNotifications notifications;
    private final com.proj.server.workos.WorkOSService workOS;
    private final TransactionTemplate transactions;

    public WorkOrderAssignmentService(
            WorkOrderRepository repository,
            WorkOrderService orders,
            RoutingRepository routing,
            WorkOrderNotifications notifications,
            com.proj.server.workos.WorkOSService workOS,
            TransactionTemplate transactions) {
        this.repository = repository;
        this.orders = orders;
        this.routing = routing;
        this.notifications = notifications;
        this.workOS = workOS;
        this.transactions = transactions;
    }

    /** The resolved assignee: who, the name saved with the order, and a contractor's email. */
    record Target(Assignee who, String name, String email) {}

    /** An owner or Manager gives the order to someone. Names are looked up before any row is locked. */
    public WorkOrderResponse assign(
            UUID estateId, UUID id, String user, String actorName, AssignWorkOrderRequest request) {
        var who = WorkOrderAssignment.target(request.userId(), request.providerId());
        var memberName =
                who.kind() == Kind.MEMBER ? workOS.findDisplayName(who.id()).orElse(TEAM_MEMBER) : null;
        return transactions.execute(status -> {
            orders.authorize(estateId, user, true, true);
            var target = resolve(estateId, who, memberName);
            var row = lock(estateId, id, request.version());
            apply(estateId, row, target, user, actorName, user, null);
            return repository.detail(estateId, id);
        });
    }

    public WorkOrderResponse unassign(UUID estateId, UUID id, String user, String actorName, int version) {
        return transactions.execute(status -> {
            orders.authorize(estateId, user, true, true);
            var row = lock(estateId, id, version);
            var from = WorkOrderStatus.valueOf(row.getStatus());
            var current = Assignee.of(row.getAssigneeuserid(), row.getAssigneeproviderid());
            var change = WorkOrderAssignment.unassign(from, current);
            if (change.noOp()) return repository.detail(estateId, id);
            var now = OffsetDateTime.now(ZoneOffset.UTC);
            leave(row, current, null, now);
            int next = row.getVersion() + 1;
            repository.updateAssignee(id, null, null, null, null, change.status(), now, next);
            repository.appendEvent(
                    id,
                    estateId,
                    from,
                    change.status(),
                    user,
                    actorName,
                    now,
                    next,
                    WorkOrderStatusEventKind.UNASSIGNED,
                    null);
            return repository.detail(estateId, id);
        });
    }

    /**
     * Gives an open order to a contractor for ID-70 routing and the older dispatch endpoint. The caller holds the
     * estate lock and the transaction and has authorized the actor; {@code approvedBy} is null when the system routed it.
     */
    public void assignContractor(
            UUID estateId,
            UUID id,
            UUID providerId,
            EquipmentType type,
            String user,
            String actorName,
            String approvedBy) {
        var row = repository.lockOrder(estateId, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        if (WorkOrderStatus.valueOf(row.getStatus()) != WorkOrderStatus.OPEN)
            throw error(HttpStatus.CONFLICT, "Only an open work order can be assigned to a contractor.");
        apply(
                estateId,
                row,
                resolve(estateId, Assignee.contractor(providerId), null),
                user,
                actorName,
                approvedBy,
                type);
    }

    public AssigneeCandidatesResponse assignees(UUID estateId, String user) {
        orders.authorize(estateId, user, true, false);
        var members = repository.assignableMembers(estateId).entrySet().stream()
                .map(entry -> new AssigneeCandidatesResponse.Member(
                        entry.getKey(),
                        workOS.findDisplayName(entry.getKey()).orElse(TEAM_MEMBER),
                        "CREW".equals(entry.getValue())
                                ? AssigneeCandidatesResponse.Role.CREW
                                : AssigneeCandidatesResponse.Role.MANAGER))
                .sorted(Comparator.comparing(AssigneeCandidatesResponse.Member::name, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(AssigneeCandidatesResponse.Member::userId))
                .toList();
        var contractors = repository.providers(estateId).stream()
                .map(provider ->
                        new AssigneeCandidatesResponse.Contractor(provider.id(), provider.name(), provider.email()))
                .toList();
        return new AssigneeCandidatesResponse(members, contractors);
    }

    private Target resolve(UUID estateId, Assignee who, String memberName) {
        if (who.kind() == Kind.MEMBER) {
            if (!repository.isAssignableMember(estateId, who.id()))
                throw error(
                        HttpStatus.UNPROCESSABLE_CONTENT,
                        "Only a Manager or Crew member of this estate can be given a job.");
            return new Target(who, memberName, null);
        }
        var provider = repository.provider(estateId, UUID.fromString(who.id()));
        if (provider == null)
            throw error(HttpStatus.UNPROCESSABLE_CONTENT, "Choose a contractor from this estate's list.");
        return new Target(who, provider.name(), provider.email());
    }

    private com.proj.server.db.tables.records.WorkorderRecord lock(UUID estateId, UUID id, int version) {
        var row = repository.lockOrder(estateId, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        if (row.getVersion() != version)
            throw error(HttpStatus.CONFLICT, "This work order changed. Refresh and review it before saving.");
        return row;
    }

    private void apply(
            UUID estateId,
            com.proj.server.db.tables.records.WorkorderRecord row,
            Target target,
            String user,
            String actorName,
            String approvedBy,
            EquipmentType type) {
        var from = WorkOrderStatus.valueOf(row.getStatus());
        var current = Assignee.of(row.getAssigneeuserid(), row.getAssigneeproviderid());
        var change = WorkOrderAssignment.assign(from, current, target.who());
        if (change.noOp()) return;
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        leave(row, current, target.who(), now);
        int next = row.getVersion() + 1;
        boolean member = target.who().kind() == Kind.MEMBER;
        var providerId = member ? null : UUID.fromString(target.who().id());
        repository.updateAssignee(
                row.getId(),
                member ? target.who().id() : null,
                providerId,
                target.name(),
                user,
                change.status(),
                now,
                next);
        repository.appendEvent(
                row.getId(),
                estateId,
                from,
                change.status(),
                user,
                actorName,
                now,
                next,
                WorkOrderStatusEventKind.ASSIGNED,
                target.name());
        if (member)
            notifications.assigned(
                    estateId,
                    row.getId(),
                    row.getAssetid(),
                    target.who().id(),
                    actorName == null ? "You've been given a job" : "Given to you by " + actorName);
        else routing.createDispatch(row.getId(), estateId, type, providerId, target.name(), target.email(), approvedBy);
    }

    /** The previous assignee loses the job: their pending email never goes and their notification resolves. */
    private void leave(
            com.proj.server.db.tables.records.WorkorderRecord row,
            Assignee current,
            Assignee next,
            OffsetDateTime now) {
        if (WorkOrderAssignment.supersedes(current, next)) routing.supersedePending(row.getId(), now);
        if (current != null && current.kind() == Kind.MEMBER && !current.equals(next))
            notifications.resolve(row.getId(), current.id());
    }

    private static WorkOrderException error(HttpStatus status, String message) {
        return new WorkOrderException(status, message);
    }
}
