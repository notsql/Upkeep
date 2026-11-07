package com.proj.server.assethistory;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "reference",
            "name",
            "category",
            "locationPath",
            "installedOn",
            "retiredOn",
            "status"
        })
public record AssetHistorySummaryResponse(
        UUID id,
        String reference,
        String name,
        String category,
        String locationPath,
        @Schema(nullable = true) LocalDate installedOn,
        @Schema(nullable = true) LocalDate retiredOn,
        Status status) {
    public enum Status {
        ACTIVE,
        RETIRED
    }
}
