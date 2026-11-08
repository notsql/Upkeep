package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Documents the body only. It is not bound by Jackson: {@link ReadingValidator}
 * reads it strictly, and each item as a single reading.
 */
@Schema(
        requiredProperties = {"readings"},
        additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
public record TelemetryBatchRequest(
        @ArraySchema(minItems = 1, maxItems = 500, schema = @Schema(implementation = CreateReadingRequest.class))
        List<CreateReadingRequest> readings) {}
