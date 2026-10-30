package com.proj.server.category;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"code", "label", "failsSilently", "isDefault", "activeAssetCount", "lastChange"})
public record EstateAssetCategoryResponse(
        String code,
        String label,
        boolean failsSilently,

        @Schema(description = "True until the flag has been changed in this estate")
        boolean isDefault,

        @Schema(description = "Active (not retired) assets of this category in the estate")
        int activeAssetCount,

        @Schema(nullable = true) FlagChangeResponse lastChange) {}
