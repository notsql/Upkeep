package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor", "counts"})
public record ResidentReportPageResponse(
        List<IssueReportSummaryResponse> items,
        @Schema(nullable = true) String nextCursor,
        ReportCounts counts) {
    /** Totals over every report the resident can see, not just this page. */
    @Schema(requiredProperties = {"open", "inProgress", "resolved"})
    public record ReportCounts(int open, int inProgress, int resolved) {}
}
