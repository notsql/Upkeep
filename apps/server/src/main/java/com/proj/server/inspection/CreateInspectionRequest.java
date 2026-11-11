package com.proj.server.inspection;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Schema(requiredProperties = {"outcome", "inspectedOn", "expectedLocationId"})
public record CreateInspectionRequest(
        @Schema(description = "The inspection id the photo slots returned; required when photoKeys is not empty.")
        UUID inspectionId,

        @NotNull InspectionOutcome outcome,
        @NotNull LocalDate inspectedOn,

        @Schema(description = "Up to 2,000 characters. Required (not blank) when outcome is FAIL: what is wrong.")
        String notes,

        @NotNull UUID expectedLocationId,

        @ArraySchema(
                maxItems = 3,
                arraySchema = @Schema(description = "Object keys from the photo slots, uploaded already."))
        List<String> photoKeys) {}
