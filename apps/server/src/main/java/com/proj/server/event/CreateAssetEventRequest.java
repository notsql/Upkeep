package com.proj.server.event;

import com.proj.server.workorder.WholeNumberDeserializer;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import tools.jackson.databind.annotation.JsonDeserialize;

/** The optional maintenance details are null when not known; blank text counts as not known. */
public record CreateAssetEventRequest(
        @NotNull AssetEventType type,
        @NotNull LocalDate occurredOn,
        @NotBlank @Size(max = 2000) String notes,
        @Size(max = 2500) String findings,
        @Size(max = 2500) String workPerformed,
        @Size(max = 200) String serviceProvider,
        @Size(max = 2500) String partsReplaced,

        @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer downtimeMinutes) {
    public CreateAssetEventRequest {
        notes = notes == null ? null : notes.strip();
        findings = known(findings);
        workPerformed = known(workPerformed);
        serviceProvider = known(serviceProvider);
        partsReplaced = known(partsReplaced);
    }

    private static String known(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
