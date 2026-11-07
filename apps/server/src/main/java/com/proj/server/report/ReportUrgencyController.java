package com.proj.server.report;

import com.proj.server.estate.EstateError;
import com.proj.server.resident.ResidentReportException;
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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportUrgencyController {
    private final ReportUrgencyService urgency;
    private final EstateReportService reports;

    public ReportUrgencyController(ReportUrgencyService urgency, EstateReportService reports) {
        this.urgency = urgency;
        this.reports = reports;
    }

    @PatchMapping("/estates/{estateId}/reports/{reportId}/urgency")
    @Operation(
            operationId = "changeEstateReportUrgency",
            summary = "Change report urgency and Safety marking (Managers only)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Updated report and its latest change"),
        @ApiResponse(
                responseCode = "400",
                description = "Invalid request or Safety below Urgent",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "401",
                description = "Sign in required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "403",
                description = "Manager membership required",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "404",
                description = "Estate or report not found",
                content = @Content(schema = @Schema(implementation = EstateError.class))),
        @ApiResponse(
                responseCode = "409",
                description = "Stale version or inactive estate",
                content = @Content(schema = @Schema(implementation = EstateError.class)))
    })
    public ResponseEntity<EstateIssueReportDetailResponse> change(
            @AuthenticationPrincipal Jwt principal,
            @PathVariable UUID estateId,
            @PathVariable UUID reportId,
            @Valid @RequestBody ChangeReportUrgencyRequest request) {
        if (principal == null
                || principal.getSubject() == null
                || principal.getSubject().isBlank())
            throw new ResidentReportException(HttpStatus.UNAUTHORIZED, "Sign in to access reports.");
        var user = principal.getSubject();
        urgency.change(estateId, reportId, user, request);
        return ResponseEntity.ok()
                .header("Cache-Control", "private, no-store")
                .body(reports.detail(estateId, user, reportId));
    }
}
