package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;

/** A work order's contractor email, or null when none has been sent. */
@Schema(requiredProperties = {"dispatch"})
public record WorkOrderDispatchStatusResponse(
        @Schema(nullable = true) WorkOrderDispatchResponse dispatch) {}
