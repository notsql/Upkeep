package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** Who a manager sends to inspect one piece of equipment. */
public record InspectionRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Must be able to record inspections")
        @NotBlank
        String assignedToUserId) {}
