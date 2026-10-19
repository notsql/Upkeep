package com.proj.server.location;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/** Floors are numbered without a zero: B1 = -1, L1 = 1 (see bulk-floors spec). */
public record AddFloorsRequest(
        @NotNull @Schema(description = "The lowest floor: negative for basements (B2 = -2), never 0")
        Integer lowestFloor,

        @NotNull @Schema(description = "The highest floor: L25 = 25, never 0")
        Integer highestFloor) {}
