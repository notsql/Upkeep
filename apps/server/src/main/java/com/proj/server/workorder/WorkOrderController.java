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

    public WorkOrderController(WorkOrderService orders) {
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
        return privateResponse(
                orders.list(estateId, subject(principal), priority, q, sortBy, direction, cursor, limit));
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
