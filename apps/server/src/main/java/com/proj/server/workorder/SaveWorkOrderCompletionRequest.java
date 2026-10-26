package com.proj.server.workorder;

import jakarta.validation.constraints.*;
import tools.jackson.databind.annotation.JsonDeserialize;

public record SaveWorkOrderCompletionRequest(
        @NotNull @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer expectedVersion,

        @NotBlank @Size(max = 2500) String findings,
        @NotBlank @Size(max = 2500) String workPerformed,
        @Size(max = 2500) String partsUsed,
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?") String labourCost,
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?") String partsCost,

        @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer downtimeMinutes) {
    public SaveWorkOrderCompletionRequest {
        findings = findings == null ? null : findings.trim();
        workPerformed = workPerformed == null ? null : workPerformed.trim();
        partsUsed = partsUsed == null || partsUsed.isBlank() ? null : partsUsed.trim();
    }
}
