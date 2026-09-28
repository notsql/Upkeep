package com.proj.server.asset;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateAssetAssessmentRequest(
        @NotNull AssetCondition condition,
        @NotNull LocalDate assessedOn,
        @NotBlank @Size(max = 2000) String notes) {
    public CreateAssetAssessmentRequest {
        notes = notes == null ? null : notes.strip();
    }
}
