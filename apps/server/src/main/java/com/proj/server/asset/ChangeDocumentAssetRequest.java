package com.proj.server.asset;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.proj.server.workorder.WholeNumberDeserializer;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import tools.jackson.databind.annotation.JsonDeserialize;

@Schema(requiredProperties = {"assetId", "expectedAssociationVersion"})
public record ChangeDocumentAssetRequest(
        @JsonProperty(value = "assetId", required = true)
        @Schema(nullable = true, description = "Send null explicitly to unlink; unlink before selecting another asset")
        UUID assetId,

        @NotNull @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer expectedAssociationVersion) {}
