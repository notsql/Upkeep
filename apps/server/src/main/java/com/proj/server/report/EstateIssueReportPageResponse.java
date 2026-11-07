package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record EstateIssueReportPageResponse(
        List<EstateIssueReportSummaryResponse> items,
        @Schema(nullable = true) String nextCursor) {}
