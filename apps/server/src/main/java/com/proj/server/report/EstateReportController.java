package com.proj.server.report;

import com.proj.server.estate.EstateError;
import com.proj.server.resident.ResidentReportException;
import com.proj.server.routing.RoutingState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/estates/{estateId}/reports")
@ApiResponses({
    @ApiResponse(
            responseCode = "400",
            description = "Invalid UUID, request or pagination",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "401",
            description = "Sign in required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "403",
            description = "Responder membership required",
            content = @Content(schema = @Schema(implementation = EstateError.class))),
    @ApiResponse(
            responseCode = "404",
            description = "Inaccessible estate, report, location or image",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
})
public class EstateReportController {
    private final EstateReportService reports;

    public EstateReportController(EstateReportService reports) {
        this.reports = reports;
    }

    @GetMapping
    @Operation(
            operationId = "listEstateReports",
            summary = "List fault reports by location subtree, block and inclusive level-position range")
    @ApiResponse(responseCode = "200", description = "Reports ordered by creation time and ID, newest first")
    public ResponseEntity<EstateReportPageResponse> list(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @RequestParam(required = false) UUID locationId,
            @Parameter(description = "Block ID in this estate; includes historical locations")
                    @RequestParam(required = false)
                    UUID blockId,
            @Parameter(description = "Inclusive minimum LEVEL.sortOrder, including negative positions")
                    @RequestParam(required = false)
                    Integer minLevelPosition,
            @Parameter(description = "Inclusive maximum LEVEL.sortOrder, including negative positions")
                    @RequestParam(required = false)
                    Integer maxLevelPosition,
            @Parameter(description = "Only reports in this routing state; reports from before routing never match")
                    @RequestParam(required = false)
                    RoutingState routingState,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        return privateResponse(reports.list(
                estateId,
                subject(principal),
                locationId,
                blockId,
                minLevelPosition,
                maxLevelPosition,
                routingState,
                cursor,
                limit));
    }

    @GetMapping("/{reportId}")
    @Operation(operationId = "getEstateReport")
    @ApiResponse(responseCode = "200", description = "Report with current location path and private image metadata")
    public ResponseEntity<EstateReportDetailResponse> detail(
            @AuthenticationPrincipal Jwt principal, @PathVariable UUID estateId, @PathVariable UUID reportId) {
        return privateResponse(reports.detail(estateId, subject(principal), reportId));
    }

    @PatchMapping("/{reportId}/location")
    @Operation(operationId = "relocateEstateReport")
    @ApiResponse(responseCode = "200", description = "Corrected report, or unchanged report for a no-op")
    @ApiResponse(
            responseCode = "409",
            description = "Stale placement, inactive estate or inactive destination/ancestor",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    public ResponseEntity<EstateReportDetailResponse> relocate(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID reportId,
            @Valid @RequestBody RelocateReportRequest request) {
        return privateResponse(reports.relocate(estateId, subject(principal), reportId, request));
    }

    @GetMapping(
            value = "/{reportId}/images/{imageId}",
            produces = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE})
    @Operation(operationId = "getEstateReportImage")
    @ApiResponse(
            responseCode = "200",
            description = "Private image bytes",
            content = {
                @Content(mediaType = MediaType.IMAGE_JPEG_VALUE, schema = @Schema(type = "string", format = "binary")),
                @Content(mediaType = MediaType.IMAGE_PNG_VALUE, schema = @Schema(type = "string", format = "binary"))
            })
    @ApiResponse(
            responseCode = "503",
            description = "Private image storage unavailable",
            content = @Content(schema = @Schema(implementation = EstateError.class)))
    public ResponseEntity<byte[]> image(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID reportId,
            @PathVariable UUID imageId) {
        var image = reports.image(estateId, subject(principal), reportId, imageId);
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .contentType(MediaType.parseMediaType(image.contentType()))
                .body(image.bytes());
    }

    private static <T> ResponseEntity<T> privateResponse(T body) {
        return ResponseEntity.ok().header("Cache-Control", "private, no-store").body(body);
    }

    private static String subject(Jwt principal) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new ResidentReportException(HttpStatus.UNAUTHORIZED, "Sign in to access reports.");
        return principal.getSubject();
    }
}
