package com.proj.server.asset;

import jakarta.validation.constraints.*;

public record RestoreAssetRequest(
        @NotBlank @Size(max = 60) String reference,
        @NotNull @PositiveOrZero Integer expectedVersion) {}
