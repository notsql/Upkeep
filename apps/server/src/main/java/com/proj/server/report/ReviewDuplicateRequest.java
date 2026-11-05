package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Moves a duplicate link to CONFIRMED or REJECTED. Allowed: SUSPECTED to CONFIRMED, SUSPECTED to REJECTED and
 * CONFIRMED to REJECTED.
 */
public record ReviewDuplicateRequest(
        @NotNull @Schema(allowableValues = {"CONFIRMED", "REJECTED"})
        DuplicateState state,

        @NotNull
        @Schema(
                allowableValues = {"SUSPECTED", "CONFIRMED"},
                description = "The link state the caller saw")
        DuplicateState expectedState) {}
