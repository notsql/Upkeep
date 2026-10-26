package com.proj.server.inspection;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record InspectionResultPageResponse(
        List<InspectionResultResponse> items,
        @Schema(nullable = true) String nextCursor) {}
