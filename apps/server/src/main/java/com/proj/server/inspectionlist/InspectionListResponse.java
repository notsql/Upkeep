package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(
        requiredProperties = {
            "month",
            "estateActive",
            "generatedAt",
            "generatedByName",
            "overdueCount",
            "dueCount",
            "doneCount",
            "checks",
            "unscheduled"
        })
public record InspectionListResponse(
        @Schema(description = "The first day of the current month (Singapore)")
        LocalDate month,

        boolean estateActive,

        @Schema(nullable = true, description = "The latest generation this month, or null when not yet generated")
        OffsetDateTime generatedAt,

        @Schema(nullable = true) String generatedByName,
        int overdueCount,
        int dueCount,
        int doneCount,

        @Schema(description = "Overdue checks and this month's checks, by block, level, status, due date and reference")
        List<InspectionCheckResponse> checks,

        List<UnscheduledAssetResponse> unscheduled) {}
