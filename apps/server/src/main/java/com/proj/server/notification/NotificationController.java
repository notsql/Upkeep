package com.proj.server.notification;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The caller's notifications across the estates they manage (ID-100). */
@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class NotificationController {
    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping("/notifications/unread-count")
    @Operation(operationId = "getUnreadNotificationCount")
    @ApiResponse(responseCode = "200", description = "Unread notifications in the estates the caller manages")
    public NotificationCountResponse unread(@AuthenticationPrincipal Jwt jwt) {
        return service.unread(user(jwt));
    }

    @GetMapping("/notifications")
    @Operation(operationId = "listNotifications")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Newest first"),
        @ApiResponse(
                responseCode = "400",
                description = "Bad page or size",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public NotificationPageResponse list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "" + NotificationService.DEFAULT_SIZE) int size) {
        return service.list(user(jwt), page, size);
    }

    @PostMapping("/notifications/{notificationId}/read")
    @Operation(operationId = "markNotificationRead")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Read for the caller"),
        @ApiResponse(
                responseCode = "404",
                description = "Unknown, or not in an estate the caller manages",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<Void> read(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID notificationId) {
        service.read(notificationId, user(jwt));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/notifications/read-all")
    @Operation(operationId = "markAllNotificationsRead")
    @ApiResponse(responseCode = "200", description = "The unread count afterwards")
    public NotificationCountResponse readAll(@AuthenticationPrincipal Jwt jwt) {
        return service.readAll(user(jwt));
    }

    @PostMapping("/notifications/{notificationId}/acknowledge")
    @Operation(operationId = "acknowledgeAnomalyAlert")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The alert after acknowledging; read for the caller"),
        @ApiResponse(
                responseCode = "400",
                description = "Reason over 500 characters",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Unknown, or not in an estate the caller manages",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Not an anomaly alert, already dismissed, retired asset or inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public NotificationResponse acknowledge(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId,
            @RequestBody AcknowledgeAlertRequest request) {
        return service.acknowledge(notificationId, user(jwt), request);
    }

    @PostMapping("/notifications/{notificationId}/dismiss")
    @Operation(operationId = "dismissAnomalyAlert")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The alert after dismissing; read for the caller"),
        @ApiResponse(
                responseCode = "400",
                description = "Reason missing, blank or over 500 characters",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Unknown, or not in an estate the caller manages",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Not an anomaly alert, already dismissed, retired asset or inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public NotificationResponse dismiss(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId,
            @RequestBody DismissAlertRequest request) {
        return service.dismiss(notificationId, user(jwt), request);
    }

    @GetMapping("/estates/{estateId}/assets/{assetId}/anomaly-alerts")
    @Operation(operationId = "listAssetAnomalyAlerts")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The asset's anomaly alerts, newest first"),
        @ApiResponse(
                responseCode = "403",
                description = "Resident membership does not grant management access",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Estate not managed by the caller, or unknown asset",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public List<NotificationResponse> assetAlerts(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.assetAlerts(estateId, assetId, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new NotificationException(HttpStatus.UNAUTHORIZED, "Sign in to see notifications.");
        }
        return jwt.getSubject();
    }
}
