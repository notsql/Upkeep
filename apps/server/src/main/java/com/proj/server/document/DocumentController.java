package com.proj.server.document;

import com.proj.server.estate.EstateError;
import com.proj.server.storage.SignedDownloadResponse;
import com.proj.server.storage.UploadSlotResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/estates/{estateId}/documents")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid document request, upload, search, cursor or limit",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Estate document permission required; deletion also requires uploader or Manager",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or document unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "500",
            description = "Document metadata operation failed",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Document storage unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class DocumentController {
    private final DocumentService documents;

    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @PostMapping("/upload-slots")
    @Operation(operationId = "createDocumentUploadSlot")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Ten-minute upload link for one file"),
        @ApiResponse(
                responseCode = "409",
                description = "Estate inactive",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "413",
                description = "File exceeds 5,000,000 bytes",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "415",
                description = "Use a PDF, JPEG or PNG with a matching extension and media type",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<UploadSlotResponse> uploadSlot(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @Valid @RequestBody DocumentUploadSlotRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(documents.uploadSlot(
                        estateId, subject(principal), body.fileName(), body.contentType(), body.size()));
    }

    @PostMapping
    @Operation(operationId = "uploadDocument")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Uploaded file checked and indexed"),
        @ApiResponse(
                responseCode = "409",
                description = "Estate inactive",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "413",
                description = "Uploaded file exceeds 5,000,000 bytes",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "415",
                description = "Use matching PDF, JPEG or PNG extension, media type and signature",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @Valid @RequestBody CreateDocumentRequest body) {
        var created =
                documents.upload(estateId, subject(principal), body.documentType(), body.objectKey(), body.fileName());
        return ResponseEntity.created(URI.create("/estates/" + estateId + "/documents/" + created.id() + "/content"))
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(created);
    }

    @GetMapping
    @Operation(operationId = "listDocuments")
    @ApiResponse(responseCode = "200", description = "Committed documents, newest first")
    public ResponseEntity<DocumentPageResponse> list(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @RequestParam(required = false) @Schema(maxLength = 255) String filename,
            @RequestParam(required = false) DocumentType documentType,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) @Schema(minimum = "1", maximum = "100", defaultValue = "25")
                    Integer limit) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(documents.list(estateId, subject(principal), filename, documentType, cursor, limit));
    }

    @GetMapping("/{documentId}/content")
    @Operation(operationId = "downloadDocument")
    @ApiResponse(responseCode = "200", description = "A five-minute link that downloads the file")
    public ResponseEntity<SignedDownloadResponse> download(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID documentId) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(documents.download(estateId, documentId, subject(principal)));
    }

    @DeleteMapping("/{documentId}")
    @Operation(operationId = "deleteDocument")
    @ApiResponse(
            responseCode = "204",
            description = "Platform removal committed; storage cleanup may be retried",
            content = @Content)
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID documentId) {
        documents.delete(estateId, documentId, subject(principal));
        return ResponseEntity.noContent()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .build();
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in to access documents.");
        return principal.getSubject();
    }

    @Schema(requiredProperties = {"fileName", "contentType", "size"})
    public record DocumentUploadSlotRequest(
            @NotBlank @Schema(maxLength = 255) String fileName,
            @NotBlank String contentType,
            @NotNull Long size) {}

    @Schema(requiredProperties = {"objectKey", "fileName", "documentType"})
    public record CreateDocumentRequest(
            @NotBlank @Schema(description = "The key from the upload slot, after the file was uploaded.")
            String objectKey,

            @NotBlank @Schema(maxLength = 255) String fileName,
            @NotNull DocumentType documentType) {}
}
