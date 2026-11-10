package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(requiredProperties = {"equipmentType"})
public record DispatchRequest(@NotNull EquipmentType equipmentType) {}
