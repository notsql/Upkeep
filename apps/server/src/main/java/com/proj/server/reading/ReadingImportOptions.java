package com.proj.server.reading;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;

public record ReadingImportOptions(
        @NotNull UUID submissionId,
        @NotBlank @Size(max = 200) String sourceLabel,
        @NotNull ReadingImportPreset preset,
        @NotBlank String assetLookupMode,
        @NotNull Map<String, String> mapping) {}
