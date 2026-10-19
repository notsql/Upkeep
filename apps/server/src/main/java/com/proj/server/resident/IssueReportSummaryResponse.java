package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {"id", "title", "description", "estateName", "location", "status", "createdAt", "updatedAt"
        })
public record IssueReportSummaryResponse(
        UUID id,
        @Schema(minLength = 1, maxLength = 150) String title,
        String description,
        String estateName,
        ReportLocation location,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
    @Schema(requiredProperties = {"id", "label"})
    public record ReportLocation(UUID id, String label) {}
}
