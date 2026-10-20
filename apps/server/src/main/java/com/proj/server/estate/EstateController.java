package com.proj.server.estate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates")
@ApiResponses({
    @ApiResponse(
            responseCode = "403",
            description = "Resident membership does not grant management access",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Duplicate estate code",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateController {
    private final EstateService service;

    public EstateController(EstateService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Your estates")
    @Operation(summary = "List your estates")
    public List<EstateResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false, defaultValue = "ACTIVE") EstateStatus status) {
        return service.list(owner(jwt), status);
    }

    @GetMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Estate details")
    public EstateResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(id, owner(jwt));
    }

    @PostMapping
    @ApiResponse(responseCode = "201", description = "Estate created")
    public ResponseEntity<EstateResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody EstateRequest request) {
        var estate = service.create(owner(jwt), request);
        return ResponseEntity.created(URI.create("/estates/" + estate.id())).body(estate);
    }

    @PatchMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Estate updated")
    public EstateResponse update(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody EstateRequest request) {
        return service.update(id, owner(jwt), request);
    }

    @PostMapping("/{id}/deactivate")
    @ApiResponse(responseCode = "200", description = "Estate deactivated")
    public EstateResponse deactivate(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody DeactivateEstateRequest request) {
        return service.deactivate(id, owner(jwt), request.code());
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new EstateException(HttpStatus.UNAUTHORIZED, "Sign in to manage estates.");
        }
        return jwt.getSubject();
    }
}
