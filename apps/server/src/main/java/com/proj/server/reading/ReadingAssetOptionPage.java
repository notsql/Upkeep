package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "page", "size", "totalItems"})
public record ReadingAssetOptionPage(List<ReadingAssetOption> items, int page, int size, long totalItems) {}
