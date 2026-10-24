package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid definition or identifier",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(responseCode = "401", description = "Sign in required", content = @Content),
    @ApiResponse(
            responseCode = "403",
            description = "Estate permission required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or role not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Duplicate, stale version, inactive estate or assigned members",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Storage unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateRoleController {
    private final EstateRoleService service;

    public EstateRoleController(EstateRoleService service) {
        this.service = service;
    }

    @GetMapping("/role-permissions")
    @ApiResponse(responseCode = "200", description = "Grantable permission catalogue")
    public ResponseEntity<List<EstatePermissionResponse>> catalogue(
            @PathVariable UUID estateId, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .body(service.catalogue(estateId, user(jwt)));
    }

    @GetMapping("/roles")
    @ApiResponse(responseCode = "200", description = "Estate-scoped custom definitions")
    public ResponseEntity<List<EstateRoleDefinitionResponse>> list(
            @PathVariable UUID estateId, @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(service.list(estateId, user(jwt)));
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @ApiResponse(responseCode = "201", description = "Custom role created")
    public EstateRoleDefinitionResponse create(
            @PathVariable UUID estateId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateEstateRoleRequest request) {
        return service.create(estateId, user(jwt), request);
    }

    @PutMapping("/roles/{roleId}")
    @ApiResponse(responseCode = "200", description = "Custom role updated")
    public EstateRoleDefinitionResponse update(
            @PathVariable UUID estateId,
            @PathVariable UUID roleId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateEstateRoleDefinitionRequest request) {
        return service.update(estateId, roleId, user(jwt), request);
    }

    @DeleteMapping("/roles/{roleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ApiResponse(
            responseCode = "204",
            description = "Role and associated invitation history permanently deleted",
            content = @Content)
    public void delete(@PathVariable UUID estateId, @PathVariable UUID roleId, @AuthenticationPrincipal Jwt jwt) {
        service.delete(estateId, roleId, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to manage estate roles.");
        return jwt.getSubject();
    }
}
