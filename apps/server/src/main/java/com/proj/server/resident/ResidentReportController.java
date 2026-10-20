package com.proj.server.resident;

import com.proj.server.estate.EstateError;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/resident")
public class ResidentReportController {
    private final ResidentReportService reports;

    public ResidentReportController(ResidentReportService reports) {
        this.reports = reports;
    }

    @GetMapping("/context")
    @Operation(operationId = "residentContext")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Assigned resident estate"),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResidentContextResponse context(@AuthenticationPrincipal Jwt principal) {
        return reports.context(subject(principal));
    }

    @GetMapping("/locations")
    @Operation(operationId = "residentLocations")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Active locations in the assigned estate"),
        @ApiResponse(
                responseCode = "403",
                description = "Resident membership required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public List<ResidentLocationResponse> locations(
            @AuthenticationPrincipal Jwt principal, @RequestParam UUID estateId) {
        return reports.locations(subject(principal), estateId);
    }

    @PostMapping(value = "/reports", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(operationId = "createResidentReport")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Report submitted"),
        @ApiResponse(
                responseCode = "400",
                description = "Invalid title, description, image or location",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "403",
                description = "Active resident membership required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "413",
                description = "Upload too large",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "415",
                description = "Unsupported image type",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Image storage unavailable",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<IssueReportDetailResponse> create(
            @AuthenticationPrincipal Jwt principal, @Valid @ModelAttribute CreateIssueReportRequest request) {
        var created = reports.create(
                subject(principal),
                request.estateId(),
                request.title(),
                request.description(),
                request.locationId(),
                request.images());
        return ResponseEntity.created(URI.create("/resident/reports/" + created.id()))
                .body(created);
    }

    @GetMapping("/reports")
    @Operation(operationId = "listResidentReports")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Own report history"),
        @ApiResponse(
                responseCode = "400",
                description = "Invalid cursor or limit",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public IssueReportPageResponse list(
            @AuthenticationPrincipal Jwt principal,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return reports.list(subject(principal), cursor, limit);
    }

    @GetMapping("/reports/{reportId}")
    @Operation(operationId = "getResidentReport")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Own report details"),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Report not found",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public IssueReportDetailResponse detail(@AuthenticationPrincipal Jwt principal, @PathVariable UUID reportId) {
        return reports.detail(subject(principal), reportId);
    }

    @GetMapping(
            value = "/reports/{reportId}/images/{imageId}",
            produces = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE})
    @Operation(operationId = "getResidentReportImage")
    @ApiResponses({
        @ApiResponse(
                responseCode = "200",
                content = {
                    @Content(
                            mediaType = MediaType.IMAGE_JPEG_VALUE,
                            schema = @Schema(type = "string", format = "binary")),
                    @Content(
                            mediaType = MediaType.IMAGE_PNG_VALUE,
                            schema = @Schema(type = "string", format = "binary"))
                }),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Report image not found",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "503",
                description = "Image storage unavailable",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<byte[]> image(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID reportId, @PathVariable UUID imageId) {
        var image = reports.image(subject(principal), reportId, imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(image.bytes());
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank()) {
            throw new ResidentReportException(HttpStatus.UNAUTHORIZED, "Sign in to access reports.");
        }
        return principal.getSubject();
    }

    @Schema(requiredProperties = {"estateId", "title", "description", "locationId"})
    public record CreateIssueReportRequest(
            @NotNull UUID estateId,
            @NotBlank @Schema(minLength = 1, maxLength = 50) String title,

            @NotBlank String description,
            @NotNull UUID locationId,
            List<MultipartFile> images) {}
}
