package com.proj.server.report;

import com.proj.server.resident.IssueReportDetailResponse;
import com.proj.server.resident.IssueReportDetailResponse.ReportImage;
import com.proj.server.resident.IssueReportSummaryResponse.ReportLocation;
import com.proj.server.routing.ReportRoutingResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Responder report detail: the resident detail plus duplicate, urgency and routing (ID-70) information. */
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
            "images",
            "duplicates",
            "urgency",
            "isSafety",
            "urgencyVersion",
            "lastUrgencyChange",
            "routing"
        })
public record EstateIssueReportDetailResponse(
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
        List<ReportImage> images,

        @Schema(description = "SUSPECTED and CONFIRMED duplicates of this report, newest first")
        List<LinkedDuplicate> duplicates,

        ReportUrgency urgency,
        boolean isSafety,
        int urgencyVersion,
        @Schema(types = {"object", "null"}) ReportUrgencyChange lastUrgencyChange,

        @Schema(nullable = true, description = "Null for reports submitted before automatic routing")
        ReportRoutingResponse routing) {
    static EstateIssueReportDetailResponse of(
            IssueReportDetailResponse report,
            DuplicateRepository.Summary info,
            List<LinkedDuplicate> duplicates,
            ReportUrgencyRepository.Values values,
            ReportUrgencyChange change,
            ReportRoutingResponse routing) {
        return new EstateIssueReportDetailResponse(
                report.id(),
                report.title(),
                report.description(),
                report.estateName(),
                report.location(),
                report.status(),
                report.createdAt(),
                report.updatedAt(),
                info.confirmed(),
                info.suspected(),
                info.duplicateOf(),
                report.images(),
                duplicates,
                values.urgency(),
                values.isSafety(),
                values.version(),
                change,
                routing);
    }
}
