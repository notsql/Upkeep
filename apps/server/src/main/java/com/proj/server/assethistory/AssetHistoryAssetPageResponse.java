package com.proj.server.assethistory;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record AssetHistoryAssetPageResponse(
        List<AssetHistorySummaryResponse> items,
        @Schema(nullable = true) String nextCursor) {}
