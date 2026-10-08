package com.proj.server.asset;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record RetirementCorrectionRequest(
        @NotNull LocalDate retiredOn,
        @NotBlank @Size(max = 2000) String retirementReason,
        @NotNull @PositiveOrZero Integer expectedVersion) {
    public RetirementCorrectionRequest {
        retirementReason = retirementReason == null ? null : retirementReason.strip();
    }
}
