package com.proj.server.event;

import com.proj.server.workorder.WholeNumberDeserializer;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import tools.jackson.databind.annotation.JsonDeserialize;

/** The optional details and costs are null when not known; blank text counts as not known. */
public record CreateAssetEventRequest(
        @NotNull AssetEventType type,
        @NotNull LocalDate occurredOn,
        @NotBlank @Size(max = 2000) String notes,
        @Size(max = 2500) String findings,
        @Size(max = 2500) String workPerformed,
        @Size(max = 200) String serviceProvider,
        @Size(max = 2500) String partsReplaced,

        @Min(0) @JsonDeserialize(using = WholeNumberDeserializer.class)
        Integer downtimeMinutes,

        // SGD, validated as for work-order completions; omitted means not known.
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?") String labourCost,
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?") String partsCost,
        @Pattern(regexp = "[0-9]{1,12}(\\.[0-9]{1,2})?") String otherCost) {
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
