package com.proj.server.inspection;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(requiredProperties = {"contentType", "size"})
public record InspectionPhotoSlotRequest(
        @Schema(description = "The inspection id from this inspection's first slot; omit for the first photo.")
        UUID inspectionId,

        @NotBlank String contentType,
        @NotNull Long size) {}
