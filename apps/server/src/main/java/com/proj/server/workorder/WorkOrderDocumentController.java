package com.proj.server.workorder;

import com.proj.server.document.DocumentPageResponse;
import com.proj.server.estate.EstateError;
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
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid document association, reason, version or cursor",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Document and work-order permissions required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Missing, deleted or inaccessible document/work order",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate or stale association version",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "500",
            description = "Document association operation failed",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class WorkOrderDocumentController {
    private final WorkOrderDocumentService documents;

    public WorkOrderDocumentController(WorkOrderDocumentService documents) {
        this.documents = documents;
    }

    @GetMapping("/documents/{documentId}/work-order")
    @Operation(operationId = "getDocumentWorkOrder")
    @ApiResponse(responseCode = "200", description = "Current document association, including an unlinked document")
    public ResponseEntity<DocumentWorkOrderResponse> association(
            @PathVariable UUID estateId, @PathVariable UUID documentId, @AuthenticationPrincipal Jwt principal) {
        return privateResponse(documents.association(estateId, documentId, subject(principal)));
    }

    @PutMapping("/documents/{documentId}/work-order")
    @Operation(operationId = "changeDocumentWorkOrder")
    @ApiResponse(responseCode = "200", description = "Association saved, or unchanged target with current version")
    public ResponseEntity<DocumentWorkOrderResponse> change(
            @PathVariable UUID estateId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody ChangeDocumentWorkOrderRequest request) {
        String user = subject(principal);
        return privateResponse(documents.change(estateId, documentId, user, documents.actorName(user), request));
    }

    @GetMapping("/documents/{documentId}/work-order/history")
    @Operation(operationId = "getDocumentWorkOrderHistory")
    @ApiResponse(responseCode = "200", description = "Chronological paginated document association audit")
    public ResponseEntity<DocumentWorkOrderEventPageResponse> history(
            @PathVariable UUID estateId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(documents.history(estateId, documentId, subject(principal), cursor, limit));
    }

    @GetMapping("/work-orders/{workOrderId}/documents")
    @Operation(operationId = "getWorkOrderDocuments")
    @ApiResponse(responseCode = "200", description = "Current nondeleted document attachments, newest uploads first")
    public ResponseEntity<DocumentPageResponse> attachments(
            @PathVariable UUID estateId,
            @PathVariable UUID workOrderId,
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(documents.attachments(estateId, workOrderId, subject(principal), cursor, limit));
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new WorkOrderException(HttpStatus.UNAUTHORIZED, "Sign in required.");
        return principal.getSubject();
    }

    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }
}
