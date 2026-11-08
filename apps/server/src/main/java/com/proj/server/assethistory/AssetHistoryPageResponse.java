package com.proj.server.assethistory;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"asset", "items", "nextCursor", "documentsVisible"})
public record AssetHistoryPageResponse(
        AssetHistorySummaryResponse asset,
        List<AssetHistoryEntryResponse> items,
        @Schema(nullable = true) String nextCursor,
        boolean documentsVisible) {}
