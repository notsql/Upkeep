package com.proj.server.catalogue;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"code", "label"})
public record AssetCategoryResponse(String code, String label) {}
