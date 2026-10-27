package com.proj.server.report;

import com.proj.server.resident.IssueReportSummaryResponse;
import com.proj.server.routing.ReportRoutingResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/** A report as staff see it: the resident's summary plus routing, which resident responses never carry. */
@Schema(
        requiredProperties = {
            "id",
            "title",
            "description",
            "estateName",
            "location",
            "status",
            "createdAt",
            "updatedAt",
            "routing"
        })
public record EstateReportSummaryResponse(
        UUID id,
        @Schema(minLength = 1, maxLength = 150) String title,
        String description,
        String estateName,
        IssueReportSummaryResponse.ReportLocation location,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,

        @Schema(nullable = true, description = "Null for reports submitted before automatic routing")
        ReportRoutingResponse routing) {
    static EstateReportSummaryResponse of(IssueReportSummaryResponse report, ReportRoutingResponse routing) {
        return new EstateReportSummaryResponse(
                report.id(),
                report.title(),
                report.description(),
                report.estateName(),
                report.location(),
                report.status(),
                report.createdAt(),
                report.updatedAt(),
                routing);
    }
}
