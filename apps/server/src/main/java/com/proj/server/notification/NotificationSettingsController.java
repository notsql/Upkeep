package com.proj.server.notification;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** An estate's notification switches (spec notification-switches-and-milestone-reminders.md, "Notification settings"). */
@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Resident membership does not grant management access",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate not found or not managed by the caller",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class NotificationSettingsController {
    private final NotificationSettingsService service;

    public NotificationSettingsController(NotificationSettingsService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/notification-settings")
    @Operation(operationId = "getNotificationSettings")
    @ApiResponse(responseCode = "200", description = "The saved settings, or the defaults")
    public NotificationSettingsResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.get(estateId, user(jwt));
    }

    @PutMapping("/estates/{estateId}/notification-settings")
    @Operation(operationId = "saveNotificationSettings")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The saved settings"),
        @ApiResponse(
                responseCode = "400",
                description = "A switch is missing",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public NotificationSettingsResponse save(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Valid @RequestBody NotificationSettingsRequest request) {
        return service.save(estateId, request, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new NotificationException(HttpStatus.UNAUTHORIZED, "Sign in to manage notification settings.");
        }
        return jwt.getSubject();
    }
}
