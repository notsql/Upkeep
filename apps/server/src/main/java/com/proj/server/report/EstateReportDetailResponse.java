package com.proj.server.report;

import com.proj.server.resident.IssueReportDetailResponse;
import com.proj.server.resident.IssueReportSummaryResponse;
import com.proj.server.routing.ReportRoutingResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

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
            "images",
            "routing"
        })
public record EstateReportDetailResponse(
        UUID id,
        @Schema(minLength = 1, maxLength = 150) String title,
        String description,
        String estateName,
        IssueReportSummaryResponse.ReportLocation location,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<IssueReportDetailResponse.ReportImage> images,

        @Schema(nullable = true, description = "Null for reports submitted before automatic routing")
        ReportRoutingResponse routing) {
    static EstateReportDetailResponse of(IssueReportDetailResponse report, ReportRoutingResponse routing) {
        return new EstateReportDetailResponse(
                report.id(),
                report.title(),
                report.description(),
                report.estateName(),
                report.location(),
                report.status(),
                report.createdAt(),
                report.updatedAt(),
                report.images(),
                routing);
    }
}
