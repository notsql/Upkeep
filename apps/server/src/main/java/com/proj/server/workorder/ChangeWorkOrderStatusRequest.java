package com.proj.server.workorder;

import jakarta.validation.constraints.*;
import tools.jackson.databind.annotation.JsonDeserialize;

public record ChangeWorkOrderStatusRequest(
        @NotNull WorkOrderStatus targetStatus,

        @NotNull @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer expectedVersion) {}
