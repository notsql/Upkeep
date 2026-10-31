package com.proj.server.reading;

import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
public class ReadingExportController {
    private final EstateReadingService access;
    private final ReadingExportService export;
    private final ReadingExportAdmission admission;

    public ReadingExportController(
            EstateReadingService access, ReadingExportService export, ReadingExportAdmission admission) {
        this.access = access;
        this.export = export;
        this.admission = admission;
    }

    @GetMapping(value = "/estates/{estateId}/readings/export", produces = "text/csv")
    @Operation(
            operationId = "exportEstateReadings",
            summary = "Export every matching manual and sensor reading as CSV v1")
    @ApiResponse(
            responseCode = "200",
            headers = {
                @io.swagger.v3.oas.annotations.headers.Header(
                        name = "X-Export-Row-Count",
                        required = true,
                        description = "Complete row count from the same query snapshot",
                        schema = @Schema(type = "integer", format = "int64")),
                @io.swagger.v3.oas.annotations.headers.Header(
                        name = "Content-Disposition",
                        required = true,
                        description = "CSV v1 attachment filename",
                        schema = @Schema(type = "string"))
            },
            description =
                    "CSV v1; X-Export-Row-Count is the complete matching count, including beyond any browser page",
            content = @Content(mediaType = "text/csv", schema = @Schema(type = "string", format = "binary")))
    @ApiResponse(
            responseCode = "400",
            description = "Invalid filters",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "403",
            description = "Readings access required",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "404",
            description = "Estate or asset not found",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EstateError.class)))
    @ApiResponse(
            responseCode = "503",
            description = "Export capacity busy; retry later",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EstateError.class)))
    public ResponseEntity<StreamingResponseBody> export(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID estateId,
            @RequestParam(required = false) UUID assetId,
            @RequestParam(required = false) DeviceMetric metric,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to,
            @RequestParam(required = false) List<ReadingFlagType> flag,
            HttpServletResponse response,
            HttpServletRequest request) {
        if (jwt == null || jwt.getSubject() == null || jwt.getSubject().isBlank())
            throw new ReadingException(HttpStatus.UNAUTHORIZED, "Sign in to export readings.");
        String user = jwt.getSubject();
        access.validateExport(estateId, user, assetId, from, to);
        var flags = flag == null || flag.isEmpty() ? EnumSet.noneOf(ReadingFlagType.class) : EnumSet.copyOf(flag);
        var timestamp = OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ofPattern("uuuuMMdd'T'HHmmss'Z'"));
        var lease = admission.acquire(request);
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .header(
                        "Content-Disposition",
                        "attachment; filename=\"readings-v1-" + estateId + "-" + timestamp + ".csv\"")
                .header("Content-Type", "text/csv; charset=utf-8")
                .body(output -> {
                    try (lease) {
                        export.write(estateId, user, assetId, metric, from, to, flags, response, output);
                    }
                });
    }
}
