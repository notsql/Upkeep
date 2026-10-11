package com.proj.server.asset;

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
@RequestMapping("/estates/{estateId}/assets")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid request or wrong confirmation reference",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate, asset or location not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, asset or location, or a conflicting change",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetController {
    private final AssetService service;

    public AssetController(AssetService service) {
        this.service = service;
    }

    @PostMapping
    @ApiResponse(responseCode = "201", description = "Asset registered with a generated reference")
    @Operation(operationId = "createAsset")
    public ResponseEntity<AssetResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @Valid @RequestBody CreateAssetRequest request) {
        var asset = service.create(estateId, owner(jwt), request);
        return ResponseEntity.created(URI.create("/estates/" + estateId + "/assets/" + asset.id()))
                .body(asset);
    }

    @GetMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Asset details, including deactivated assets")
    @Operation(operationId = "getAsset")
    public AssetResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID id) {
        return service.get(estateId, id, owner(jwt));
    }

    @PatchMapping("/{id}")
    @ApiResponse(responseCode = "200", description = "Asset updated or moved")
    @Operation(operationId = "updateAsset")
    public AssetResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAssetRequest request) {
        return service.update(estateId, id, owner(jwt), request);
    }

    @PostMapping("/{id}/deactivate")
    @ApiResponse(responseCode = "200", description = "Asset deactivated")
    @Operation(operationId = "deactivateAsset")
    public AssetResponse deactivate(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID id,
            @Valid @RequestBody DeactivateAssetRequest request) {
        return service.deactivate(estateId, id, owner(jwt), request);
    }

    @GetMapping
    @Operation(operationId = "listAssets")
    @ApiResponse(responseCode = "200", description = "Asset register")
    public java.util.List<AssetResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) AssetConditionFilter condition,
            @RequestParam(defaultValue = "ACTIVE") AssetStatus status) {
        return service.list(estateId, owner(jwt), q, category, locationId, condition, status);
    }

    @GetMapping("/{id}/lifecycle-events")
    @Operation(operationId = "listAssetLifecycleEvents")
    @ApiResponse(responseCode = "200", description = "Asset lifecycle history, newest first")
    public java.util.List<AssetLifecycleEventResponse> events(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID id) {
        return service.events(estateId, id, owner(jwt));
    }

    @PatchMapping("/{id}/retirement")
    @Operation(operationId = "correctAssetRetirement")
    @ApiResponse(responseCode = "200", description = "Retirement information corrected")
    public AssetResponse correctRetirement(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID id,
            @Valid @RequestBody RetirementCorrectionRequest request) {
        return service.correctRetirement(estateId, id, owner(jwt), request);
    }

    @PostMapping("/{id}/restore")
    @Operation(operationId = "restoreAsset")
    @ApiResponse(responseCode = "200", description = "Asset restored")
    public AssetResponse restore(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID id,
            @Valid @RequestBody RestoreAssetRequest request) {
        return service.restore(estateId, id, owner(jwt), request);
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AssetException(HttpStatus.UNAUTHORIZED, "Sign in to manage assets.");
        }
        return jwt.getSubject();
    }
}
