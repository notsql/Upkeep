package com.proj.server.inspectionlist;

import com.proj.server.category.IntervalSource;
import com.proj.server.category.ServiceInterval;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "assetId",
            "assetReference",
            "assetName",
            "categoryLabel",
            "block",
            "level",
            "dueOn",
            "dueBasis",
            "interval",
            "intervalSource",
            "status",
            "result",
            "requestedByName",
            "assignedToName"
        })
public record InspectionCheckResponse(
        UUID id,
        UUID assetId,
        String assetReference,
        String assetName,
        String categoryLabel,
        InspectionLocationResponse block,

        @Schema(nullable = true, description = "Null for an asset on the block or a block's common area")
        InspectionLocationResponse level,

        LocalDate dueOn,
        DueBasis dueBasis,

        @Schema(nullable = true, description = "The service interval the due date was worked out from")
        ServiceInterval interval,

        @Schema(
                nullable = true,
                allowableValues = {"ASSET", "CATEGORY"})
        IntervalSource intervalSource,

        CheckStatus status,
        @Schema(nullable = true) CheckResultResponse result,

        @Schema(nullable = true, description = "Who sent crew; set only for REQUESTED checks")
        String requestedByName,

        @Schema(nullable = true, description = "Who was sent to inspect; set only for REQUESTED checks")
        String assignedToName) {}
