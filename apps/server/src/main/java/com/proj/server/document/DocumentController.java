package com.proj.server.document;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/estates/{estateId}/documents")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid document request, file, search, cursor or limit",
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

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(operationId = "uploadDocument")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Document stored and indexed"),
        @ApiResponse(
                responseCode = "409",
                description = "Estate inactive",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "413",
                description = "File exceeds 5,000,000 bytes or multipart request exceeds servlet limits",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "415",
                description = "Use matching PDF, JPEG or PNG extension, media type and signature",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @Valid @ModelAttribute UploadDocumentRequest body,
            MultipartHttpServletRequest request) {
        String user = subject(principal);
        var files = request.getMultiFileMap();
        if (files.size() != 1
                || files.get("file") == null
                || files.get("file").size() != 1
                || request.getParameterValues("documentType") == null
                || request.getParameterValues("documentType").length != 1)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose exactly one file and one document type.");
        var created = documents.upload(estateId, user, body.documentType(), body.file());
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
    @ApiResponse(
            responseCode = "200",
            description = "Private attachment",
            content = {
                @Content(mediaType = "application/pdf", schema = @Schema(type = "string", format = "binary")),
                @Content(mediaType = "image/jpeg", schema = @Schema(type = "string", format = "binary")),
                @Content(mediaType = "image/png", schema = @Schema(type = "string", format = "binary"))
            })
    public ResponseEntity<byte[]> download(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID documentId) {
        var file = documents.download(estateId, documentId, subject(principal));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(file.filename(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(file.bytes());
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

    @Schema(requiredProperties = {"documentType", "file"})
    public record UploadDocumentRequest(
            @NotNull DocumentType documentType,

            @NotNull @Schema(type = "string", format = "binary")
            MultipartFile file) {}
}
