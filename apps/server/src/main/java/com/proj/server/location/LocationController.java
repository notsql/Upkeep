package com.proj.server.location;

import com.proj.server.estate.EstateError;
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
@RequestMapping("/estates/{estateId}/locations")
@ApiResponses({
    @ApiResponse(
            responseCode = "403",
            description = "Resident membership does not grant management access",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request or hierarchy shape",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or location not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Duplicate name or level position, inactive estate or location, or active children",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class LocationController {
    private final LocationService service;

    public LocationController(LocationService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "The estate's active locations, siblings in display order")
    @Operation(operationId = "listLocations", summary = "List an estate's active locations")
    public List<LocationResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return service.list(estateId, owner(jwt), includeInactive);
    }

    @PostMapping
    @ApiResponse(responseCode = "201", description = "Location created")
    @Operation(operationId = "createLocation")
    public ResponseEntity<LocationResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Valid @RequestBody CreateLocationRequest request) {
        var location = service.create(estateId, owner(jwt), request);
        return ResponseEntity.created(URI.create("/estates/" + estateId + "/locations/" + location.id()))
                .body(location);
    }

    @PatchMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Location renamed, reordered or moved")
    @Operation(operationId = "updateLocation")
    public LocationResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateLocationRequest request) {
        return service.update(estateId, id, owner(jwt), request);
    }

    @PostMapping("/{id}/deactivate")
    @ApiResponse(responseCode = "200", description = "Location deactivated")
    @Operation(operationId = "deactivateLocation")
    public LocationResponse deactivate(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID id) {
        return service.deactivate(estateId, id, owner(jwt));
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new LocationException(HttpStatus.UNAUTHORIZED, "Sign in to manage locations.");
        }
        return jwt.getSubject();
    }
}
