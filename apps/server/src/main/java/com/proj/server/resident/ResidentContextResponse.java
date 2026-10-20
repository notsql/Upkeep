package com.proj.server.resident;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(requiredProperties = {"estates", "canSubmit"})
public record ResidentContextResponse(List<EstateLabel> estates, boolean canSubmit) {
    @Schema(requiredProperties = {"id", "name"})
    public record EstateLabel(UUID id, String name) {}
}
