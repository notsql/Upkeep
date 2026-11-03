package com.proj.server.category;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        requiredProperties = {
            "effective",
            "source",
            "override",
            "categoryInterval",
            "categoryLabel",
            "lastOverrideChange"
        })
public record AssetServiceIntervalResponse(
        @Schema(nullable = true, description = "The override if set, else the category's interval")
        ServiceInterval effective,

        IntervalSource source,
        @Schema(nullable = true) ServiceInterval override,
        @Schema(nullable = true) ServiceInterval categoryInterval,
        String categoryLabel,
        @Schema(nullable = true) IntervalChangeResponse lastOverrideChange) {}
