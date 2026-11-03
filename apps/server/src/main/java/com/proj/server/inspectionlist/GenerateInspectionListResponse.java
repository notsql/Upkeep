package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"added", "list"})
public record GenerateInspectionListResponse(
        @Schema(description = "Checks added by this generation; 0 when nothing new is due")
        int added,

        InspectionListResponse list) {}
