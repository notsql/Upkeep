package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** The equipment's work order that is not closed yet. */
@Schema(requiredProperties = {"id", "reference"})
public record OpenWorkOrderResponse(UUID id, String reference) {}
