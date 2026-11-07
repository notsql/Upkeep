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

/** An estate's view of the asset categories and their silent-failure flags (ID-83). */
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
            description = "Estate not found or not managed by the caller, or unknown category",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetCategorySettingsController {
    private final AssetCategorySettingsService service;

    public AssetCategorySettingsController(AssetCategorySettingsService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/asset-categories")
    @ApiResponse(responseCode = "200", description = "Every asset category with its flag and active-asset count")
    @Operation(operationId = "listEstateAssetCategories")
    public EstateAssetCategoriesResponse list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.list(estateId, user(jwt));
    }

    @PutMapping("/estates/{estateId}/asset-categories/{category}/silent-failure")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "The category with its current flag"),
        @ApiResponse(
                responseCode = "400",
                description = "failsSilently missing or not a boolean",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    @Operation(operationId = "setAssetCategorySilentFailure")
    public EstateAssetCategoryResponse setSilentFailure(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable String category,
            @Valid @RequestBody SetSilentFailureRequest request) {
        return service.setSilentFailure(estateId, category, user(jwt), request);
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AssetCategoryException(HttpStatus.UNAUTHORIZED, "Sign in to manage asset categories.");
        }
        return jwt.getSubject();
    }
}
