package com.proj.server.asset;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record DeactivateAssetRequest(
        @NotBlank @Size(max = 60) String reference,
        @NotNull LocalDate retiredOn,
        @NotBlank @Size(max = 2000) String retirementReason,
        @NotNull @PositiveOrZero Integer expectedVersion) {
    public DeactivateAssetRequest {
        retirementReason = retirementReason == null ? null : retirementReason.strip();
    }
}
