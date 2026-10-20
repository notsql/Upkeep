package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"estate", "canSubmit"})
public record ResidentContextResponse(EstateLabel estate, boolean canSubmit) {
    @Schema(requiredProperties = {"id", "name"})
    public record EstateLabel(UUID id, String name) {}
}
