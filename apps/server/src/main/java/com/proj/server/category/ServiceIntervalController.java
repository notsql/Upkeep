package com.proj.server.category;

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

/** Manufacturer service intervals per asset category and per asset (ID-81). */
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
            description = "Estate not found or not managed by the caller, or unknown category or asset",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class ServiceIntervalController {
    private final AssetCategorySettingsService categories;
    private final ServiceIntervalService service;

    public ServiceIntervalController(AssetCategorySettingsService categories, ServiceIntervalService service) {
        this.categories = categories;
        this.service = service;
    }

    @PutMapping("/estates/{estateId}/asset-categories/{category}/service-interval")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The category with its current interval"),
        @ApiResponse(
                responseCode = "400",
                description =
                        "interval missing, or not null or a value and unit (DAY up to 3650, MONTH up to 120, YEAR up to 10)",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    @Operation(operationId = "setAssetCategoryServiceInterval")
    public EstateAssetCategoryResponse setCategory(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable String category,
            @Valid @RequestBody SetServiceIntervalRequest request) {
        return categories.setServiceInterval(estateId, category, user(jwt), request);
    }

    @GetMapping("/estates/{estateId}/assets/{assetId}/service-interval")
    @ApiResponse(responseCode = "200", description = "The asset's effective interval, override and category interval")
    @Operation(operationId = "getAssetServiceInterval")
    public AssetServiceIntervalResponse get(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.get(estateId, assetId, user(jwt));
    }

    @PutMapping("/estates/{estateId}/assets/{assetId}/service-interval")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The asset's interval after the change"),
        @ApiResponse(
                responseCode = "400",
                description =
                        "interval missing, or not null or a value and unit (DAY up to 3650, MONTH up to 120, YEAR up to 10)",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate, or retired asset",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    @Operation(operationId = "setAssetServiceInterval")
    public AssetServiceIntervalResponse setAsset(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @RequestBody SetServiceIntervalRequest request) {
        return service.setOverride(estateId, assetId, user(jwt), request);
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AssetCategoryException(HttpStatus.UNAUTHORIZED, "Sign in to manage service intervals.");
        }
        return jwt.getSubject();
    }
}
