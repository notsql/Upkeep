package com.proj.server.workorder;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request or cursor",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Membership lacks permission",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Missing or inaccessible estate or related record",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, asset, location or ancestor; stale source placement",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class WorkOrderController {
    private final WorkOrderService orders;
    private final WorkOrderProgressService progress;

    public WorkOrderController(WorkOrderService orders, WorkOrderProgressService progress) {
        this.progress = progress;
        this.orders = orders;
    }

    @PostMapping("/work-orders")
    @Operation(operationId = "createWorkOrder", summary = "Create an open work order as an owner or current Manager")
    @ApiResponse(responseCode = "201", description = "Work order created")
    public ResponseEntity<WorkOrderResponse> create(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @Valid @RequestBody CreateWorkOrderRequest request) {
        var order = orders.create(estateId, subject(principal), request);
        return ResponseEntity.created(URI.create("/estates/" + estateId + "/work-orders/" + order.id()))
                .header("Cache-Control", "private, no-store")
                .body(orders.resolveCreatorName(order));
    }

    @GetMapping("/work-orders")
    @Operation(
            operationId = "listWorkOrders",
            summary = "List all estate work orders, newest first, as owner, Manager or Crew")
    @ApiResponse(responseCode = "200", description = "Paginated work orders")
    public ResponseEntity<WorkOrderPageResponse> list(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @RequestParam(required = false) WorkOrderPriority priority,
            @RequestParam(required = false) WorkOrderStatus status,
            @RequestParam(required = false) WorkOrderCategory category,
            @io.swagger.v3.oas.annotations.Parameter(
                            description =
                                    "Case-insensitive literal partial work-order reference; surrounding whitespace is ignored",
                            schema = @Schema(maxLength = 200))
                    @RequestParam(required = false)
                    String q,
            @RequestParam(defaultValue = "CREATED_AT") WorkOrderSort sortBy,
            @RequestParam(defaultValue = "DESC") WorkOrderSortDirection direction,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(orders.list(
                estateId, subject(principal), priority, status, category, q, sortBy, direction, cursor, limit));
    }

    @GetMapping("/work-orders/{workOrderId}")
    @Operation(operationId = "getWorkOrder")
    @ApiResponse(responseCode = "200", description = "Saved work order")
    public ResponseEntity<WorkOrderResponse> detail(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID workOrderId) {
        return privateResponse(orders.detail(estateId, subject(principal), workOrderId));
    }

    @GetMapping("/work-order-assets")
    @Operation(operationId = "listWorkOrderAssets", summary = "Limited active asset picker for owners and Managers")
    @ApiResponse(responseCode = "200", description = "Paginated asset options ordered by reference and ID")
    public ResponseEntity<WorkOrderAssetPageResponse> assets(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(orders.assets(estateId, subject(principal), q, cursor, limit));
    }

    @PatchMapping("/work-orders/{workOrderId}/status")
    @Operation(operationId = "changeWorkOrderStatus", summary = "Start work as an active owner or Manager")
    @ApiResponse(
            responseCode = "200",
            description = "Updated work order; current-version no-op returns unchanged order")
    public ResponseEntity<WorkOrderResponse> changeStatus(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID workOrderId,
            @Valid @RequestBody ChangeWorkOrderStatusRequest request) {
        var user = subject(principal);
        return privateResponse(orders.resolveCreatorName(
                progress.change(estateId, workOrderId, user, progress.actorName(user), request)));
    }

    @PutMapping("/work-orders/{workOrderId}/completion")
    @Operation(
            operationId = "saveWorkOrderCompletion",
            summary = "Close work with a recorded outcome; identical retries are idempotent")
    @ApiResponse(
            responseCode = "201",
            description = "Completion created",
            content = @Content(schema = @Schema(implementation = WorkOrderResponse.class)))
    @ApiResponse(
            responseCode = "200",
            description = "Identical completion replay",
            content = @Content(schema = @Schema(implementation = WorkOrderResponse.class)))
    public ResponseEntity<WorkOrderResponse> complete(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID workOrderId,
            @Valid @RequestBody SaveWorkOrderCompletionRequest request) {
        var user = subject(principal);
        var result = progress.complete(estateId, workOrderId, user, progress.actorName(user), request);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .header("Cache-Control", "private, no-store")
                .body(orders.resolveCreatorName(result.order()));
    }

    @PatchMapping("/work-orders/{workOrderId}/completion")
    @Operation(
            operationId = "correctWorkOrderCompletion",
            summary = "Correct a closed outcome with a reason and before/after audit")
    @ApiResponse(
            responseCode = "200",
            description = "Corrected work order, unchanged outcome or identical latest correction replay")
    public ResponseEntity<WorkOrderResponse> correctCompletion(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID workOrderId,
            @Valid @RequestBody CorrectWorkOrderCompletionRequest request) {
        var user = subject(principal);
        return privateResponse(orders.resolveCreatorName(
                progress.correct(estateId, workOrderId, user, progress.actorName(user), request)));
    }

    @GetMapping("/work-orders/{workOrderId}/completion-revisions")
    @Operation(
            operationId = "getWorkOrderCompletionRevisions",
            summary = "Read the chronological outcome correction audit")
    @ApiResponse(responseCode = "200", description = "Completion revisions, oldest first")
    public ResponseEntity<java.util.List<WorkOrderCompletionRevisionResponse>> revisions(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID workOrderId) {
        return privateResponse(progress.revisions(estateId, workOrderId, subject(principal)));
    }

    @GetMapping("/work-orders/{workOrderId}/status-history")
    @Operation(operationId = "getWorkOrderStatusHistory")
    @ApiResponse(responseCode = "200", description = "Chronological status history")
    public ResponseEntity<java.util.List<WorkOrderStatusEventResponse>> history(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID workOrderId) {
        return privateResponse(progress.history(estateId, workOrderId, subject(principal)));
    }

    @GetMapping("/assets/{assetId}/work-order-completions")
    @Operation(
            operationId = "listAssetWorkOrderCompletions",
            summary = "Canonical work-order outcomes for existing asset-history readers")
    @ApiResponse(responseCode = "200", description = "Asset work completions, newest first")
    public ResponseEntity<java.util.List<AssetWorkOrderCompletionResponse>> completions(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return privateResponse(progress.completions(estateId, assetId, subject(principal)));
    }

    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new WorkOrderException(HttpStatus.UNAUTHORIZED, "Sign in to access work orders.");
        return principal.getSubject();
    }
}
