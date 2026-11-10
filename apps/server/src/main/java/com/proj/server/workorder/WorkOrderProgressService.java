package com.proj.server.workorder;

import com.proj.server.estate.EstateRepository;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkOrderProgressService {
    private final WorkOrderRepository repository;
    private final WorkOrderService orders;
    private final EstateRepository estates;
    private final com.proj.server.workos.WorkOSService workOS;

    public WorkOrderProgressService(
            WorkOrderRepository repository,
            WorkOrderService orders,
            EstateRepository estates,
            com.proj.server.workos.WorkOSService workOS) {
        this.repository = repository;
        this.orders = orders;
        this.estates = estates;
        this.workOS = workOS;
    }

    private void authorizeUpdate(UUID estate, String user) {
        orders.authorize(estate, user, true, true);
        if (!estates.isManager(estate, user))
            throw error(HttpStatus.FORBIDDEN, "Only the owner or an assigned Manager can update work-order progress.");
    }

    /**
     * Assigns an Open order to the provider ID-70 just emailed, through the same status history as other changes.
     * The caller holds the estate lock and the transaction, and has already authorized the actor.
     */
    public void assign(UUID estate, UUID id, String user, String name) {
        var row = repository.lockOrder(estate, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        if (WorkOrderStatus.valueOf(row.getStatus()) != WorkOrderStatus.OPEN)
            throw error(HttpStatus.CONFLICT, "Only an open work order can be assigned to a contractor.");
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        int version = row.getVersion() + 1;
        repository.updateStatus(id, WorkOrderStatus.ASSIGNED, now, version);
        repository.appendStatus(id, estate, WorkOrderStatus.OPEN, WorkOrderStatus.ASSIGNED, user, name, now, version);
    }

    // Controllers resolve optional names before entering write transactions.
    public String actorName(String user) {
        return workOS.findDisplayName(user).orElse(null);
    }

    @Transactional
    public WorkOrderResponse change(
            UUID estate, UUID id, String user, String name, ChangeWorkOrderStatusRequest request) {
        authorizeUpdate(estate, user);
        var row = repository.lockOrder(estate, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        if (request.targetStatus() != WorkOrderStatus.IN_PROGRESS)
            throw error(HttpStatus.BAD_REQUEST, "Start work here; assignment and closure use their own operations.");
        if (row.getVersion().intValue() != request.expectedVersion()) throw stale();
        var from = WorkOrderStatus.valueOf(row.getStatus());
        if (from == request.targetStatus()) return repository.detail(estate, id);
        if (from != WorkOrderStatus.OPEN && from != WorkOrderStatus.ASSIGNED)
            throw error(HttpStatus.CONFLICT, "Closed work orders cannot be reopened.");
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        int version = row.getVersion() + 1;
        repository.updateStatus(id, WorkOrderStatus.IN_PROGRESS, now, version);
        repository.appendStatus(id, estate, from, WorkOrderStatus.IN_PROGRESS, user, name, now, version);
        return repository.detail(estate, id);
    }

    public record CompletionResult(WorkOrderResponse order, boolean created) {}

    @Transactional
    public CompletionResult complete(
            UUID estate, UUID id, String user, String name, SaveWorkOrderCompletionRequest request) {
        authorizeUpdate(estate, user);
        var row = repository.lockOrder(estate, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        var saved = repository.detail(estate, id);
        if (saved.status() == WorkOrderStatus.CLOSED) {
            if (sameOutcome(saved.completion(), request)) return new CompletionResult(saved, false);
            throw error(HttpStatus.CONFLICT, "This work order is already closed with a different outcome.");
        }
        if (row.getVersion().intValue() != request.expectedVersion()) throw stale();
        if (saved.status() != WorkOrderStatus.IN_PROGRESS)
            throw error(HttpStatus.CONFLICT, "Start work before recording completion.");
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        int version = row.getVersion() + 1;
        repository.complete(estate, id, user, name, request, now);
        repository.updateStatus(id, WorkOrderStatus.CLOSED, now, version);
        repository.appendStatus(id, estate, saved.status(), WorkOrderStatus.CLOSED, user, name, now, version);
        return new CompletionResult(repository.detail(estate, id), true);
    }

    @Transactional
    public WorkOrderResponse correct(
            UUID estate, UUID id, String user, String name, CorrectWorkOrderCompletionRequest request) {
        authorizeUpdate(estate, user);
        var row = repository.lockOrder(estate, id);
        if (row == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        var saved = repository.detail(estate, id);
        if (saved.status() != WorkOrderStatus.CLOSED || saved.completion() == null)
            throw error(HttpStatus.CONFLICT, "Only a closed work order's outcome can be corrected.");
        var outcome = request.outcome();
        if (row.getVersion().intValue() != request.expectedVersion()) {
            var latest = repository.latestRevision(estate, id);
            if (latest != null
                    && latest.fromVersion() == request.expectedVersion()
                    && latest.version() == row.getVersion()
                    && latest.changedByUserId().equals(user)
                    && latest.correctionReason().equals(request.correctionReason())
                    && sameOutcome(saved.completion(), outcome)) return saved;
            throw stale();
        }
        if (sameOutcome(saved.completion(), outcome)) return saved;
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        int version = row.getVersion() + 1;
        repository.correctCompletion(estate, id, user, name, outcome, now);
        repository.updateStatus(id, WorkOrderStatus.CLOSED, now, version);
        var updated = repository.detail(estate, id);
        repository.appendRevision(
                estate,
                id,
                new WorkOrderCompletionRevisionResponse(
                        UUID.randomUUID(),
                        row.getVersion(),
                        version,
                        request.correctionReason(),
                        user,
                        name,
                        now,
                        saved.completion(),
                        updated.completion()));
        return updated;
    }

    public List<WorkOrderCompletionRevisionResponse> revisions(UUID estate, UUID id, String user) {
        orders.authorize(estate, user, false, false);
        if (repository.detail(estate, id) == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        return repository.revisions(estate, id);
    }

    private static boolean sameOutcome(WorkOrderCompletionResponse saved, SaveWorkOrderCompletionRequest request) {
        return saved != null
                && Objects.equals(saved.findings(), request.findings())
                && Objects.equals(saved.workPerformed(), request.workPerformed())
                && Objects.equals(saved.partsUsed(), request.partsUsed())
                && Objects.equals(
                        WorkOrderRepository.money(saved.labourCost()), WorkOrderRepository.money(request.labourCost()))
                && Objects.equals(
                        WorkOrderRepository.money(saved.partsCost()), WorkOrderRepository.money(request.partsCost()))
                && Objects.equals(saved.downtimeMinutes(), request.downtimeMinutes());
    }

    public List<WorkOrderStatusEventResponse> history(UUID estate, UUID id, String user) {
        var order = orders.detail(estate, user, id);
        var result = new ArrayList<>(repository.history(estate, id));
        if (result.isEmpty() || result.getFirst().version() != 0) {
            // A legacy creation is derived from its saved creator/time, never migration time.
            result.addFirst(new WorkOrderStatusEventResponse(
                    order.id(),
                    null,
                    WorkOrderStatus.OPEN,
                    order.createdByUserId(),
                    order.createdByName(),
                    order.createdAt(),
                    0));
        }
        if (!result.isEmpty()
                && result.getFirst().version() == 0
                && result.getFirst().changedByName() == null) {
            var created = result.getFirst();
            result.set(
                    0,
                    new WorkOrderStatusEventResponse(
                            created.id(),
                            created.fromStatus(),
                            created.toStatus(),
                            created.changedByUserId(),
                            order.createdByName(),
                            created.changedAt(),
                            created.version()));
        }
        return result;
    }

    public List<AssetWorkOrderCompletionResponse> completions(UUID estate, UUID asset, String user) {
        if (estates.findOwned(estate, user, false).isEmpty() || repository.asset(estate, asset) == null)
            throw error(HttpStatus.NOT_FOUND, "Asset not found.");
        return repository.completions(estate, asset);
    }

    private static WorkOrderException stale() {
        return error(HttpStatus.CONFLICT, "This work order changed. Refresh and review it before saving.");
    }

    private static WorkOrderException error(HttpStatus status, String message) {
        return new WorkOrderException(status, message);
    }
}
