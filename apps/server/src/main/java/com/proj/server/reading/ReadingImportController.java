package com.proj.server.reading;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/estates/{estateId}/readings/imports")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid file, mapping or options",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Owner or Manager required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Estate or batch not found",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "409",
            description = "Inactive estate or submission conflict",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "413",
            description = "File, record or field limit exceeded",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "415",
            description = "Unsupported file or encoding",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "503",
            description = "Import capacity or database unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class ReadingImportController {
    private final ReadingImportService service;
    private final Semaphore slots = new Semaphore(2);

    public ReadingImportController(ReadingImportService service) {
        this.service = service;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(operationId = "importHistoricalReadings")
    @ApiResponse(
            responseCode = "201",
            description = "Completed batch",
            content = @Content(schema = @Schema(implementation = ReadingImportBatchResponse.class)))
    @ApiResponse(
            responseCode = "200",
            description = "Identical submission retry",
            content = @Content(schema = @Schema(implementation = ReadingImportBatchResponse.class)))
    public ResponseEntity<ReadingImportBatchResponse> upload(
            @PathVariable UUID estateId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestPart MultipartFile file,
            @Valid @RequestPart ReadingImportOptions options)
            throws IOException {
        var user = user(jwt);
        service.authorize(estateId, user, false, true);
        if (file.getSize() > ReadingImportParser.MAX_BYTES)
            throw ReadingImportParser.error(413, "Choose a CSV no larger than 25 MiB.");
        var type = file.getContentType();
        if (type != null
                && !type.startsWith("text/csv")
                && !type.equals("application/csv")
                && !type.equals("application/octet-stream"))
            throw ReadingImportParser.error(415, "Choose an uncompressed UTF-8 CSV file.");
        if (!slots.tryAcquire())
            throw ReadingImportParser.error(503, "Reading imports are busy. Please retry shortly.");
        try {
            var submitted = service.submit(estateId, user, file.getOriginalFilename(), file.getBytes(), options);
            return ResponseEntity.status(submitted.created() ? 201 : 200)
                    .header("Cache-Control", "private, no-store")
                    .body(submitted.batch());
        } finally {
            slots.release();
        }
    }

    @GetMapping
    @Operation(operationId = "listReadingImports")
    @ApiResponse(
            responseCode = "200",
            description = "Paginated import batches",
            content = @Content(schema = @Schema(implementation = ReadingImportBatchPage.class)))
    public ReadingImportBatchPage list(
            @PathVariable UUID estateId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.list(estateId, user(jwt), page, size);
    }

    @GetMapping("/{batchId}")
    @Operation(operationId = "getReadingImport")
    @ApiResponse(
            responseCode = "200",
            description = "Batch metadata and rollback audit",
            content = @Content(schema = @Schema(implementation = ReadingImportBatchResponse.class)))
    public ReadingImportBatchResponse detail(
            @PathVariable UUID estateId, @PathVariable UUID batchId, @AuthenticationPrincipal Jwt jwt) {
        return service.detail(estateId, user(jwt), batchId);
    }

    @GetMapping("/{batchId}/rows")
    @Operation(operationId = "listReadingImportRows")
    @ApiResponse(
            responseCode = "200",
            description = "Paginated row outcomes",
            content = @Content(schema = @Schema(implementation = ReadingImportRowPage.class)))
    public ReadingImportRowPage rows(
            @PathVariable UUID estateId,
            @PathVariable UUID batchId,
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) ReadingImportOutcome outcome) {
        return service.rows(estateId, user(jwt), batchId, page, size, outcome);
    }

    @PostMapping("/{batchId}/revert")
    @Operation(operationId = "revertReadingImport")
    @ApiResponse(
            responseCode = "200",
            description = "Recorded rollback result",
            content = @Content(schema = @Schema(implementation = ReadingImportBatchResponse.class)))
    public ReadingImportBatchResponse revert(
            @PathVariable UUID estateId,
            @PathVariable UUID batchId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RevertReadingImportRequest request) {
        return service.revert(estateId, user(jwt), batchId, request.reason());
    }

    @GetMapping(value = "/{batchId}/report", produces = "text/csv")
    @Operation(operationId = "downloadReadingImportReport")
    @ApiResponse(
            responseCode = "200",
            description = "Complete CSV row report",
            content = @Content(mediaType = "text/csv", schema = @Schema(type = "string", format = "binary")))
    public void report(
            @PathVariable UUID estateId,
            @PathVariable UUID batchId,
            @AuthenticationPrincipal Jwt jwt,
            HttpServletResponse response)
            throws IOException {
        var user = user(jwt);
        service.detail(estateId, user, batchId);
        response.setContentType("text/csv;charset=UTF-8");
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Disposition", "attachment; filename=\"reading-import-" + batchId + "-report.csv\"");
        var csv = new CSVPrinter(response.getWriter(), CSVFormat.RFC4180);
        csv.printRecord("recordNumber", "startingLineNumber", "outcome", "field", "code", "reason");
        int page = 0;
        while (true) {
            var rows = service.rows(estateId, user, batchId, page++, 200, null);
            for (var row : rows.items()) {
                if (row.issues().isEmpty())
                    csv.printRecord(row.recordNumber(), row.startingLineNumber(), row.outcome(), "", "", "");
                for (var issue : row.issues())
                    csv.printRecord(
                            row.recordNumber(),
                            row.startingLineNumber(),
                            row.outcome(),
                            safe(issue.field()),
                            safe(issue.code()),
                            safe(issue.reason()));
            }
            csv.flush();
            if ((long) page * 200 >= rows.totalItems()) break;
        }
    }

    private static String safe(String text) {
        return text != null && text.stripLeading().matches("^[=+@\\-].*") ? "'" + text : text;
    }

    private static String user(Jwt jwt) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw ReadingImportParser.error(401, "Sign in to manage reading imports.");
        return jwt.getSubject();
    }
}
