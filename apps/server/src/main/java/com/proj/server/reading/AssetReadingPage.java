package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "page", "size", "totalItems"})
public record AssetReadingPage(
        List<AssetReadingResponse> items,
        int page,
        int size,

        @Schema(description = "How many readings match the filters, across all pages")
        long totalItems) {}
