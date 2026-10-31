package com.proj.server.asset;

import com.proj.server.document.DocumentPageResponse;
import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
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
            description = "Invalid asset, version, cursor or limit",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Asset authority or document read permission required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Inaccessible estate or missing, foreign or deleted document/asset",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate, stale version, direct reassignment or conflicting work-order asset",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "500",
            description = "Document association operation failed",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class AssetDocumentController {
    private final AssetDocumentService documents;

    public AssetDocumentController(AssetDocumentService documents) {
        this.documents = documents;
    }

    @GetMapping("/documents/{documentId}/asset")
    @Operation(operationId = "getDocumentAsset")
    @ApiResponse(responseCode = "200", description = "Current document asset association, including unlinked state")
    public ResponseEntity<DocumentAssetResponse> association(
            @PathVariable UUID estateId, @PathVariable UUID documentId, @AuthenticationPrincipal Jwt principal) {
        return privateResponse(documents.association(estateId, documentId, subject(principal)));
    }

    @PutMapping("/documents/{documentId}/asset")
    @Operation(operationId = "changeDocumentAsset")
    @ApiResponse(
            responseCode = "200",
            description = "Saved association or current-version no-op; retired assets allowed")
    public ResponseEntity<DocumentAssetResponse> change(
            @PathVariable UUID estateId,
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt principal,
            @Valid @RequestBody ChangeDocumentAssetRequest request) {
        return privateResponse(documents.change(estateId, documentId, subject(principal), request));
    }

    @GetMapping("/assets/{assetId}/documents")
    @Operation(operationId = "getAssetDocuments")
    @ApiResponse(responseCode = "200", description = "Current nondeleted documents, newest upload first")
    public ResponseEntity<DocumentPageResponse> attachments(
            @PathVariable UUID estateId,
            @PathVariable UUID assetId,
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(documents.attachments(estateId, assetId, subject(principal), cursor, limit));
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in required.");
        return principal.getSubject();
    }

    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }
}
