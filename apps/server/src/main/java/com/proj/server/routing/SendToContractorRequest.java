package com.proj.server.routing;

import com.proj.server.workorder.WorkOrderPriority;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(requiredProperties = {"equipmentType", "priority"})
public record SendToContractorRequest(
        @NotNull EquipmentType equipmentType, @NotNull WorkOrderPriority priority) {}
