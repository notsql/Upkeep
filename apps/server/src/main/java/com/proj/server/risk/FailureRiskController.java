package com.proj.server.risk;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or asset not found",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class FailureRiskController {
    private final FailureRiskService service;

    public FailureRiskController(FailureRiskService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/assets/{assetId}/failure-risk")
    @Operation(operationId = "getAssetFailureRisk")
    @ApiResponse(responseCode = "200", description = "The asset's breakdown forecast and flags")
    public FailureRiskResponse forAsset(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return service.forAsset(estateId, assetId, owner(jwt));
    }

    @GetMapping("/estates/{estateId}/failure-risk")
    @Operation(operationId = "listEstateFailureRisk")
    @ApiResponse(
            responseCode = "200",
            description = "Active assets in silent-failure categories, flagged first, then by 90-day risk")
    public List<FailureRiskResponse> forEstate(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.forEstate(estateId, owner(jwt));
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new FailureRiskException(HttpStatus.UNAUTHORIZED, "Sign in to view failure risk.");
        }
        return jwt.getSubject();
    }
}
