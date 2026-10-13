package com.proj.server.event;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateAssetEventRequest(
        @NotNull AssetEventType type,
        @NotNull LocalDate occurredOn,
        @NotBlank @Size(max = 2000) String notes) {
    public CreateAssetEventRequest {
        notes = notes == null ? null : notes.strip();
    }
}
