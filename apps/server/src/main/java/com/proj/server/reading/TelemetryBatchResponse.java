package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"results"})
public record TelemetryBatchResponse(
        @Schema(description = "One result per submitted item, in request order")
        List<TelemetryItemResult> results) {}
