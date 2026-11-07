package com.proj.server.category;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;

/** The key must be present: null clears the interval, a missing key is refused. */
public record SetServiceIntervalRequest(
        @JsonProperty(required = true) @Schema(nullable = true, description = "The interval, or null to clear") @Valid
        ServiceInterval interval) {}
