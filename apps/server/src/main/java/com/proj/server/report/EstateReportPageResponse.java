package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record EstateReportPageResponse(
        List<EstateReportSummaryResponse> items,
        @Schema(nullable = true) String nextCursor) {}
