package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Exactly one of {@code userId} (a team member) or {@code providerId} (a contractor); otherwise 422. */
@Schema(requiredProperties = {"version"})
public record AssignWorkOrderRequest(
        @Schema(nullable = true) @Size(max = 255) String userId,
        @Schema(nullable = true) UUID providerId,
        @NotNull @Min(0) Integer version) {}
