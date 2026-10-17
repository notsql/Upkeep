package com.proj.server.asset;

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
@RequestMapping("/estates/{estateId}/assets/{assetId}/assessments")
@ApiResponses({
    @ApiResponse(
            responseCode = "403",
            description = "Resident membership does not grant management access",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "400",
            description = "Missing or invalid details, or a date in the future",
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
public class AssetAssessmentController {
    private final AssetAssessmentService service;

    public AssetAssessmentController(AssetAssessmentService service) {
        this.service = service;
    }

    @GetMapping
    @ApiResponse(responseCode = "200", description = "Every assessment, current condition first")
    @Operation(operationId = "listAssetAssessments")
    public List<AssetAssessmentResponse> list(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.list(estateId, assetId, owner(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @ApiResponse(responseCode = "201", description = "Assessment recorded")
    @Operation(operationId = "recordAssetAssessment")
    public AssetAssessmentResponse record(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @RequestBody CreateAssetAssessmentRequest request) {
        return service.record(estateId, assetId, owner(jwt), request);
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AssetException(HttpStatus.UNAUTHORIZED, "Sign in to manage assets.");
        }
        return jwt.getSubject();
    }
}
