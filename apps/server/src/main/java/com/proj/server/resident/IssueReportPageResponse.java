package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record IssueReportPageResponse(
        List<IssueReportSummaryResponse> items,
        @Schema(nullable = true) String nextCursor) {}
