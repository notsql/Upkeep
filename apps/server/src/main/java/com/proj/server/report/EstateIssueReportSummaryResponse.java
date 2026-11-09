package com.proj.server.report;

import com.proj.server.resident.IssueReportSummaryResponse;
import com.proj.server.resident.IssueReportSummaryResponse.ReportLocation;
import com.proj.server.routing.ReportRoutingResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Responder view of a report: the resident summary plus duplicate and urgency information, and routing (ID-70),
 * which resident responses never carry.
 */
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
            "confirmedDuplicateCount",
            "suspectedDuplicateCount",
            "duplicateOf",
            "urgency",
            "isSafety",
            "urgencyVersion",
            "routing"
        })
public record EstateIssueReportSummaryResponse(
        UUID id,
        @Schema(minLength = 1, maxLength = 150) String title,
        String description,
        String estateName,
        ReportLocation location,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        int confirmedDuplicateCount,
        int suspectedDuplicateCount,
        @Schema(nullable = true) DuplicateOf duplicateOf,
        ReportUrgency urgency,
        boolean isSafety,
        int urgencyVersion,

        @Schema(nullable = true, description = "Null for reports submitted before automatic routing")
        ReportRoutingResponse routing) {
    public static EstateIssueReportSummaryResponse of(
            IssueReportSummaryResponse report, ReportUrgencyRepository.Values values) {
        return new EstateIssueReportSummaryResponse(
                report.id(),
                report.title(),
                report.description(),
                report.estateName(),
                report.location(),
                report.status(),
                report.createdAt(),
                report.updatedAt(),
                0,
                0,
                null,
                values.urgency(),
                values.isSafety(),
                values.version(),
                null);
    }

    public EstateIssueReportSummaryResponse withRouting(ReportRoutingResponse reportRouting) {
        return new EstateIssueReportSummaryResponse(
                id,
                title,
                description,
                estateName,
                location,
                status,
                createdAt,
                updatedAt,
                confirmedDuplicateCount,
                suspectedDuplicateCount,
                duplicateOf,
                urgency,
                isSafety,
                urgencyVersion,
                reportRouting);
    }

    public EstateIssueReportSummaryResponse withDuplicates(DuplicateRepository.Summary info) {
        return new EstateIssueReportSummaryResponse(
                id,
                title,
                description,
                estateName,
                location,
                status,
                createdAt,
                updatedAt,
                info.confirmed(),
                info.suspected(),
                info.duplicateOf(),
                urgency,
                isSafety,
                urgencyVersion,
                routing);
    }
}
