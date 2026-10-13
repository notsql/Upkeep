package com.proj.server.event;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates/{estateId}/assets/{assetId}/events")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Missing or invalid details, a future date, or a date before installation",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or asset not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate or deactivated asset",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetEventController {
    private final AssetEventService service;

    public AssetEventController(AssetEventService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Every event, newest first")
    @Operation(operationId = "listAssetEvents")
    public List<AssetEventResponse> list(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.list(estateId, assetId, owner(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @ApiResponse(responseCode = "201", description = "Event recorded")
    @Operation(operationId = "recordAssetEvent")
    public AssetEventResponse record(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @RequestBody CreateAssetEventRequest request) {
        return service.record(estateId, assetId, owner(jwt), request);
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AssetEventException(HttpStatus.UNAUTHORIZED, "Sign in to manage assets.");
        }
        return jwt.getSubject();
    }
}
