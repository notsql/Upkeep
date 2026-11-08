package com.proj.server.cost;

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

/** Estate cost views for the owner's dashboard (ID-34, ID-33). */
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
            description = "Estate not found or not owned by the caller",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateCostController {
    private final EstateCostService service;

    public EstateCostController(EstateCostService service) {
        this.service = service;
    }

    @GetMapping("/estates/{estateId}/costs/top-assets")
    @Operation(operationId = "listCostliestAssets")
    @ApiResponse(responseCode = "200", description = "Up to five active assets by known maintenance spend")
    public List<CostliestAssetResponse> costliest(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.costliest(estateId, user(jwt));
    }

    @GetMapping("/estates/{estateId}/costs/forecast")
    @Operation(operationId = "getBudgetForecast")
    @ApiResponse(responseCode = "200", description = "Projected maintenance cost of the next 12 months")
    public BudgetForecastResponse forecast(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId) {
        return service.forecast(estateId, user(jwt));
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new EstateCostException(HttpStatus.UNAUTHORIZED, "Sign in to see estate costs.");
        }
        return jwt.getSubject();
    }
}
