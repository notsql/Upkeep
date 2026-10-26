package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"workOrderId", "reference", "locationPath", "completion"})
public record AssetWorkOrderCompletionResponse(
        UUID workOrderId, String reference, String locationPath, WorkOrderCompletionResponse completion) {}
