package com.proj.server.workorder;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import tools.jackson.databind.annotation.JsonDeserialize;

@Schema(requiredProperties = {"workOrderId", "expectedAssociationVersion"})
public record ChangeDocumentWorkOrderRequest(
        @JsonProperty(value = "workOrderId", required = true)
        @Schema(nullable = true, description = "Send null explicitly to remove the work-order link")
        UUID workOrderId,

        @NotNull @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer expectedAssociationVersion,

        @Size(max = 500) String correctionReason) {}
