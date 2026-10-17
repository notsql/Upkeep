package com.proj.server.access;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class AccessController {
    private final AccessService access;

    public AccessController(AccessService access) {
        this.access = access;
    }

    @GetMapping("/access/context")
    @Operation(operationId = "getAppAccess")
    @ApiResponse(responseCode = "200", description = "Current caller's independent estate capabilities")
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "503",
            description = "Access lookup unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    public ResponseEntity<AppAccessResponse> context(@AuthenticationPrincipal Jwt jwt, Authentication authentication) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to resolve access.");
        }
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_admin"));
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .body(access.context(jwt.getSubject(), admin));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<EstateError> unavailable() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new EstateError("Access is temporarily unavailable."));
    }
}
