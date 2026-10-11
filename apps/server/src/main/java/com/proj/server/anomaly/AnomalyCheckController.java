package com.proj.server.anomaly;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Too few or too many readings, a missing or non-finite value, or bad timestamps",
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
            description = "Not a pump, a deactivated asset, or an inactive estate",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "The anomaly model is unavailable; nothing was recorded",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AnomalyCheckController {
    private final AnomalyCheckService service;

    public AnomalyCheckController(AnomalyCheckService service) {
        this.service = service;
    }

    @PostMapping("/estates/{estateId}/assets/{assetId}/readings/anomaly-check")
    @Operation(operationId = "checkAssetReadings")
    @ApiResponse(responseCode = "200", description = "The batch was scored")
    public AnomalyCheckResponse check(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @RequestBody AnomalyCheckRequest request) {
        return service.check(estateId, assetId, request, owner(jwt));
    }

    private static String owner(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new AnomalyCheckException(HttpStatus.UNAUTHORIZED, "Sign in to check readings.");
        }
        return jwt.getSubject();
    }
}
