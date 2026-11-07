package com.proj.server.assethistory;

import com.proj.server.asset.AssetStatus;
import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
            description = "Invalid paths, filters, limit or cursor",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Owner or Council access required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or asset inaccessible or missing",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "500",
            description = "History unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetHistoryController {
    private final AssetHistoryService service;

    public AssetHistoryController(AssetHistoryService service) {
        this.service = service;
    }

    @GetMapping("/asset-history")
    @Operation(operationId = "listAssetHistoryAssets")
    @ApiResponse(responseCode = "200", description = "Read-only estate asset directory")
    public ResponseEntity<AssetHistoryAssetPageResponse> assets(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "ALL") AssetStatus status,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") int limit) {
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .body(service.assets(estateId, identity(jwt), q, status, cursor, limit));
    }

    @GetMapping("/assets/{assetId}/history")
    @Operation(operationId = "getAssetHistory")
    @ApiResponse(responseCode = "200", description = "Combined recorded asset history")
    public ResponseEntity<AssetHistoryPageResponse> history(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") int limit,
            @Parameter(
                            description = "First Singapore calendar day, inclusive",
                            schema = @Schema(type = "string", format = "date"))
                    @RequestParam(required = false)
                    String from,
            @Parameter(
                            description = "Last Singapore calendar day, inclusive",
                            schema = @Schema(type = "string", format = "date"))
                    @RequestParam(required = false)
                    String to) {
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .body(service.history(estateId, assetId, identity(jwt), cursor, limit, from, to));
    }

    private static String identity(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to view asset history.");
        return jwt.getSubject();
    }
}
