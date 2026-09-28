package com.proj.server.device;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public record CreateDeviceRequest(
        @NotBlank @Size(max = 100) String identifier,
        @NotBlank @Size(max = 200) String model,
        @NotNull UUID locationId,
        @NotEmpty List<@NotNull DeviceMetric> metrics,
        @NotNull @Min(1) @Max(86_400) Integer reportingIntervalSeconds) {
    public CreateDeviceRequest {
        identifier = identifier == null ? null : identifier.strip();
        model = model == null ? null : model.strip();
        // Catalogue order, duplicates collapsed, so the stored array is stable.
        metrics = metrics == null
                ? null
                : metrics.stream().filter(Objects::nonNull).distinct().sorted().toList();
    }
}
