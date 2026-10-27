package com.proj.server.routing;

import com.proj.server.report.EstateReportRepository;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.workorder.WorkOrderCategory;
import com.proj.server.workorder.WorkOrderPriority;
import com.proj.server.workorder.WorkOrderProgressService;
import com.proj.server.workorder.WorkOrderRepository;
import com.proj.server.workorder.WorkOrderService;
import com.proj.server.workorder.WorkOrderSource;
import com.proj.server.workorder.WorkOrderStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Work-order creators' decisions on routing (ID-70): contractors, sending escalated reports, dismissing them,
 * emailing existing work orders and retrying failed email. Authority is ID-36's: active owner or Manager.
 */
@Service
public class ReportRoutingService {
    private final WorkOrderService orders;
    private final WorkOrderProgressService progress;
    private final WorkOrderRepository workOrders;
    private final EstateReportRepository estates;
    private final RoutingRepository routing;

    public ReportRoutingService(
            WorkOrderService orders,
            WorkOrderProgressService progress,
            WorkOrderRepository workOrders,
            EstateReportRepository estates,
            RoutingRepository routing) {
        this.orders = orders;
        this.progress = progress;
        this.workOrders = workOrders;
        this.estates = estates;
        this.routing = routing;
    }

    public List<EquipmentContractorResponse> contractors(UUID estateId, String user) {
        orders.authorize(estateId, user, true, false);
        return routing.contractors(estateId).values().stream()
                .map(EquipmentContractorResponse::of)
                .toList();
    }

    @Transactional
    public EquipmentContractorResponse saveContractor(
            UUID estateId, String user, EquipmentType type, EquipmentContractorRequest request) {
        orders.authorize(estateId, user, true, true);
        var name = request.name().strip();
        var email = request.email().strip();
        if (name.isEmpty() || name.length() > 200 || hasControlCharacters(name))
            throw error(HttpStatus.BAD_REQUEST, "Enter a contractor name of 1 to 200 characters.");
        if (hasControlCharacters(email)) throw error(HttpStatus.BAD_REQUEST, "Enter a valid email address.");
        return EquipmentContractorResponse.of(routing.saveContractor(estateId, type, name, email));
    }

    @Transactional
    public void removeContractor(UUID estateId, String user, EquipmentType type) {
        orders.authorize(estateId, user, true, true);
        routing.removeContractor(estateId, type);
    }

    @Transactional
    public ReportRoutingResponse send(
            UUID estateId, String user, String name, UUID reportId, EquipmentType type, WorkOrderPriority priority) {
        orders.authorize(estateId, user, true, true);
        var role = estates.role(estateId, user, false);
        if (!"MANAGER".equals(role) && !"CREW".equals(role))
            throw error(HttpStatus.FORBIDDEN, "Responder membership required to use a report.");
        requireReport(estateId, reportId);
        requireReview(reportId);
        var contractor = routing.contractors(estateId).get(type);
        if (contractor == null) throw error(HttpStatus.CONFLICT, "No " + type + " contractor configured.");
        var workOrder = orders.createFromRoutedReport(estateId, reportId, user, priority);
        progress.assign(estateId, workOrder, user, name);
        routing.createDispatch(workOrder, estateId, type, contractor, user);
        routing.decide(reportId, RoutingState.WORK_ORDER, user, workOrder);
        return routing.routings(List.of(reportId)).get(reportId);
    }

    @Transactional
    public ReportRoutingResponse dismiss(UUID estateId, String user, UUID reportId) {
        orders.authorize(estateId, user, true, true);
        requireReport(estateId, reportId);
        requireReview(reportId);
        routing.decide(reportId, RoutingState.DISMISSED, user, null);
        return routing.routings(List.of(reportId)).get(reportId);
    }

    @Transactional
    public WorkOrderDispatchResponse dispatch(
            UUID estateId, String user, String name, UUID workOrderId, EquipmentType type) {
        orders.authorize(estateId, user, true, true);
        var order = workOrders.lockOrder(estateId, workOrderId);
        if (order == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        if (!WorkOrderCategory.EQUIPMENT_FAULT.name().equals(order.getCategory())
                || !WorkOrderSource.RESIDENT_REPORT.name().equals(order.getSource()))
            throw error(
                    HttpStatus.CONFLICT,
                    "Only equipment-fault work orders from a resident report can be emailed to a contractor.");
        if (routing.hasDispatch(workOrderId))
            throw error(HttpStatus.CONFLICT, "A contractor has already been emailed about this work order.");
        if (!WorkOrderStatus.OPEN.name().equals(order.getStatus()))
            throw error(HttpStatus.CONFLICT, "Only an open work order can be assigned to a contractor.");
        var contractor = routing.contractors(estateId).get(type);
        if (contractor == null) throw error(HttpStatus.CONFLICT, "No " + type + " contractor configured.");
        progress.assign(estateId, workOrderId, user, name);
        routing.createDispatch(workOrderId, estateId, type, contractor, user);
        return routing.dispatch(workOrderId).orElseThrow();
    }

    @Transactional
    public WorkOrderDispatchResponse retry(UUID estateId, String user, UUID workOrderId) {
        orders.authorize(estateId, user, true, true);
        var status = routing.lockDispatch(estateId, workOrderId)
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "No contractor email for this work order."));
        if (status != DispatchStatus.FAILED)
            throw error(HttpStatus.CONFLICT, "Only a contractor email that failed to send can be retried.");
        routing.requeue(workOrderId);
        return routing.dispatch(workOrderId).orElseThrow();
    }

    public WorkOrderDispatchStatusResponse dispatchStatus(UUID estateId, String user, UUID workOrderId) {
        orders.authorize(estateId, user, false, false);
        if (!routing.workOrderInEstate(estateId, workOrderId))
            throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        return new WorkOrderDispatchStatusResponse(routing.dispatch(workOrderId).orElse(null));
    }

    private void requireReport(UUID estateId, UUID reportId) {
        if (!routing.reportInEstate(estateId, reportId)) throw error(HttpStatus.NOT_FOUND, "Report not found.");
    }

    private void requireReview(UUID reportId) {
        var state = routing.lockState(reportId);
        if (state.isEmpty() || state.get() != RoutingState.NEEDS_REVIEW)
            throw error(HttpStatus.CONFLICT, "This report is not awaiting review.");
    }

    private static boolean hasControlCharacters(String value) {
        return value.chars().anyMatch(Character::isISOControl);
    }

    private static ResidentReportException error(HttpStatus status, String message) {
        return new ResidentReportException(status, message);
    }
}
