package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** An eligible asset with no service interval or prediction, so no due date. */
@Schema(requiredProperties = {"assetId", "assetReference", "assetName", "categoryLabel"})
public record UnscheduledAssetResponse(UUID assetId, String assetReference, String assetName, String categoryLabel) {}
