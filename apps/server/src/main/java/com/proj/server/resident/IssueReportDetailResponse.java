package com.proj.server.resident;

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
            "images"
        })
public record IssueReportDetailResponse(
        UUID id,
        @Schema(minLength = 1, maxLength = 150) String title,
        String description,
        String estateName,
        IssueReportSummaryResponse.ReportLocation location,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<ReportImage> images) {
    @Schema(requiredProperties = {"id", "contentType"})
    public record ReportImage(UUID id, String contentType) {}
}
