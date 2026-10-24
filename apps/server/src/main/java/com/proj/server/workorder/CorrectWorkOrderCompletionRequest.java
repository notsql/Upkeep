package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import tools.jackson.databind.annotation.JsonDeserialize;

public record CorrectWorkOrderCompletionRequest(
        @NotNull @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer expectedVersion,

        @NotBlank @Size(max = 500) String correctionReason,
        @NotBlank @Size(max = 2500) String findings,
        @NotBlank @Size(max = 2500) String workPerformed,

        @Schema(nullable = true, description = "Omit or send null to clear") @Size(max = 2500)
        String partsUsed,

        @Schema(nullable = true, description = "Omit or send null to mark unknown")
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?")
        String labourCost,

        @Schema(nullable = true, description = "Omit or send null to mark unknown")
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?")
        String partsCost,

        @Schema(nullable = true, description = "Omit or send null to mark unknown")
        @Min(0)
        @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer downtimeMinutes) {
    public CorrectWorkOrderCompletionRequest {
        correctionReason = correctionReason == null ? null : correctionReason.trim();
        findings = findings == null ? null : findings.trim();
        workPerformed = workPerformed == null ? null : workPerformed.trim();
        partsUsed = partsUsed == null || partsUsed.isBlank() ? null : partsUsed.trim();
    }

    SaveWorkOrderCompletionRequest outcome() {
        return new SaveWorkOrderCompletionRequest(
                expectedVersion, findings, workPerformed, partsUsed, labourCost, partsCost, downtimeMinutes);
    }
}
