package com.proj.server.routing;

import com.proj.server.estate.EstateError;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.workorder.WorkOrderProgressService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Decisions on reports the system escalated, and contractor email on ID-36 work orders (ID-70). */
@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid UUID, equipment type or priority",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Work-order creation authority required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Inaccessible estate, report or work order",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Not awaiting review, no contractor for the type, already emailed, or not an open "
                    + "equipment-fault work order from a report",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class RoutingController {
    private final ReportRoutingService routing;
    private final WorkOrderProgressService progress;

    public RoutingController(ReportRoutingService routing, WorkOrderProgressService progress) {
        this.routing = routing;
        this.progress = progress;
    }

    @PostMapping("/reports/{reportId}/work-order")
    @Operation(
            operationId = "sendReportToContractor",
            summary = "Create a work order from an escalated report and email the type's contractor")
    @ApiResponse(responseCode = "201", description = "The report's routing, with its assigned work order")
    public ResponseEntity<ReportRoutingResponse> send(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID reportId,
            @Valid @RequestBody SendToContractorRequest request) {
        var user = subject(principal);
        var body = routing.send(
                estateId, user, progress.actorName(user), reportId, request.equipmentType(), request.priority());
        return created(body);
    }

    @PostMapping("/reports/{reportId}/dismiss")
    @Operation(operationId = "dismissReportRouting", summary = "Handle an escalated report without a contractor email")
    @ApiResponse(responseCode = "200", description = "The report's routing, now dismissed")
    public ResponseEntity<ReportRoutingResponse> dismiss(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID reportId) {
        return privateResponse(routing.dismiss(estateId, subject(principal), reportId));
    }

    @GetMapping("/work-orders/{workOrderId}/dispatch")
    @Operation(operationId = "getWorkOrderDispatch", summary = "The contractor email for a work order, if any")
    @ApiResponse(responseCode = "200", description = "The dispatch, or null when no contractor has been emailed")
    public ResponseEntity<WorkOrderDispatchStatusResponse> dispatchStatus(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID workOrderId) {
        return privateResponse(routing.dispatchStatus(estateId, subject(principal), workOrderId));
    }

    @PostMapping("/work-orders/{workOrderId}/dispatch")
    @Operation(
            operationId = "dispatchWorkOrder",
            summary = "Assign an open equipment-fault work order to the type's contractor and email them")
    @ApiResponse(responseCode = "201", description = "The dispatch, queued for email")
    public ResponseEntity<WorkOrderDispatchResponse> dispatch(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID workOrderId,
            @Valid @RequestBody DispatchRequest request) {
        var user = subject(principal);
        return created(
                routing.dispatch(estateId, user, progress.actorName(user), workOrderId, request.equipmentType()));
    }

    @PostMapping("/work-orders/{workOrderId}/dispatch/retry")
    @Operation(operationId = "retryWorkOrderDispatch", summary = "Queue a failed contractor email for another attempt")
    @ApiResponse(responseCode = "200", description = "The dispatch, pending again")
    public ResponseEntity<WorkOrderDispatchResponse> retry(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID workOrderId) {
        return privateResponse(routing.retry(estateId, subject(principal), workOrderId));
    }

    static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }

    private static <T> ResponseEntity<T> created(T body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .header("Cache-Control", "private, no-store")
                .body(body);
    }

    static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new ResidentReportException(HttpStatus.UNAUTHORIZED, "Sign in to manage reports.");
        return principal.getSubject();
    }
}
