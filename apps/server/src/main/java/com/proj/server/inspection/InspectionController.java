package com.proj.server.inspection;

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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/estates/{estateId}")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid fields or cursor",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Inspection authority required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Related record unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive resource or changed location",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "413",
            description = "Photo too large",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "415",
            description = "Unsupported photo format",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Storage or persistence unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class InspectionController {
    private final InspectionService inspections;

    public InspectionController(InspectionService inspections) {
        this.inspections = inspections;
    }

    @PostMapping(value = "/assets/{assetId}/inspections", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ApiResponse(responseCode = "201", description = "Inspection recorded; no work order is created automatically")
    @Operation(operationId = "createInspectionResult")
    public ResponseEntity<InspectionResultResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @Valid @ModelAttribute CreateInspectionRequest request) {
        var saved = inspections.create(
                estateId,
                user(jwt),
                assetId,
                request.outcome(),
                request.inspectedOn(),
                request.notes(),
                request.expectedLocationId(),
                request.photos());
        return ResponseEntity.created(
                        URI.create("/estates/" + estateId + "/assets/" + assetId + "/inspections/" + saved.id()))
                .header("Cache-Control", "private, no-store")
                .body(saved);
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/inspection-assets")
    @Operation(operationId = "listInspectionAssets")
    public ResponseEntity<InspectionAssetPageResponse> assets(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(inspections.assets(estateId, user(jwt), q, cursor, limit));
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/inspection-assets/{assetId}")
    @Operation(operationId = "getInspectionAsset")
    public ResponseEntity<InspectionAssetResponse> asset(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID assetId) {
        return privateResponse(inspections.asset(estateId, user(jwt), assetId));
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/assets/{assetId}/inspections")
    @Operation(operationId = "listInspectionResults")
    public ResponseEntity<InspectionResultPageResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(inspections.list(estateId, user(jwt), assetId, cursor, limit));
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/assets/{assetId}/inspections/{inspectionId}")
    @Operation(operationId = "getInspectionResult")
    public ResponseEntity<InspectionResultResponse> detail(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @PathVariable UUID inspectionId) {
        return privateResponse(inspections.detail(estateId, user(jwt), assetId, inspectionId));
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/inspection-results/{inspectionId}")
    @Operation(operationId = "getInspectionSource")
    public ResponseEntity<InspectionResultResponse> source(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID estateId, @PathVariable UUID inspectionId) {
        return privateResponse(inspections.source(estateId, user(jwt), inspectionId));
    }

    @ApiResponse(responseCode = "200", description = "Authorised private inspection data")
    @GetMapping("/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}")
    @Operation(operationId = "getInspectionPhoto")
    public ResponseEntity<byte[]> photo(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @PathVariable UUID inspectionId,
            @PathVariable UUID photoId) {
        var photo = inspections.photo(estateId, user(jwt), assetId, inspectionId, photoId);
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .body(photo.bytes());
    }

    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new InspectionException(HttpStatus.UNAUTHORIZED, "Sign in to view or record inspections.");
        return jwt.getSubject();
    }
}
