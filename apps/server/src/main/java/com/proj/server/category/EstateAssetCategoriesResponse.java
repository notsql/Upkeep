package com.proj.server.category;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"estateActive", "categories"})
public record EstateAssetCategoriesResponse(
        boolean estateActive,

        @Schema(description = "Flagged categories first, then the rest, each by label")
        List<EstateAssetCategoryResponse> categories) {}
