package com.proj.server.cost;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** One of the estate's costliest assets by known maintenance spend (ID-34). */
@Schema(
        requiredProperties = {
            "assetId",
            "assetReference",
            "assetName",
            "category",
            "categoryLabel",
            "totalSpend",
            "entriesWithUnknownCosts"
        })
public record CostliestAssetResponse(
        UUID assetId,
        String assetReference,
        String assetName,
        String category,
        String categoryLabel,
        @Schema(description = "SGD, two-decimal string") String totalSpend,

        @Schema(description = "Entries with at least one unknown cost")
        int entriesWithUnknownCosts) {}
