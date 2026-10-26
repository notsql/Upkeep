package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items"})
public record WorkOrderAssetPageResponse(List<WorkOrderAssetOptionResponse> items, String nextCursor) {}
