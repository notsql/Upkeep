package com.proj.server.flatline;

import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Estate role does not allow this operation",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or device not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, retired asset, or conflicting sensor configuration",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Sensor data is unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class FlatlineController {
    private final FlatlineService service;

    public FlatlineController(FlatlineService service) {
        this.service = service;
    }

    @GetMapping("/flatline-policies")
    @ApiResponse(responseCode = "200", description = "All metric policies and estate sensor permissions")
    public ResponseEntity<FlatlinePoliciesResponse> policies(
            @PathVariable UUID estateId, @AuthenticationPrincipal Jwt jwt, Authentication auth) {
        return response(HttpStatus.OK, service.policies(estateId, user(jwt), admin(auth)));
    }

    @PutMapping("/flatline-policies/{metric}")
    @ApiResponse(responseCode = "200", description = "Saved estate metric policy")
    public ResponseEntity<FlatlinePolicyResponse> setPolicy(
            @PathVariable UUID estateId,
            @PathVariable DeviceMetric metric,
            @Valid @RequestBody SetFlatlinePolicyRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication auth) {
        return response(HttpStatus.OK, service.setPolicy(estateId, metric, request, user(jwt), admin(auth)));
    }

    @GetMapping("/flatlined-sensors")
    @ApiResponse(responseCode = "200", description = "Derived sensor monitoring review, filtered before pagination")
    public ResponseEntity<FlatlineReviewResponse> review(
            @PathVariable UUID estateId,
            @AuthenticationPrincipal Jwt jwt,
            Authentication auth,
            @RequestParam(defaultValue = "REVIEW", required = false) FlatlineView view,
            @RequestParam(defaultValue = "0", required = false) int page,
            @RequestParam(defaultValue = "25", required = false) int size) {
        return response(HttpStatus.OK, service.review(estateId, user(jwt), admin(auth), view, page, size));
    }

    @PostMapping("/devices/{deviceId}/flatline-pauses/{metric}")
    @ApiResponse(
            responseCode = "201",
            description = "Finite maintenance pause; expiry retained as a fresh-start cutoff")
    public ResponseEntity<FlatlinePauseResponse> pause(
            @PathVariable UUID estateId,
            @PathVariable UUID deviceId,
            @PathVariable DeviceMetric metric,
            @Valid @RequestBody CreateFlatlinePauseRequest request,
            @AuthenticationPrincipal Jwt jwt,
            Authentication auth) {
        return response(HttpStatus.CREATED, service.pause(estateId, deviceId, metric, request, user(jwt), admin(auth)));
    }

    private static <T> ResponseEntity<T> response(HttpStatus status, T body) {
        return ResponseEntity.status(status)
                .header("Cache-Control", "private, no-store")
                .body(body);
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to monitor device readings.");
        }
        return jwt.getSubject();
    }

    private static boolean admin(Authentication authentication) {
        return authentication != null
                && authentication.getAuthorities().stream()
                        .anyMatch(a -> a.getAuthority().equals("ROLE_admin"));
    }
}
