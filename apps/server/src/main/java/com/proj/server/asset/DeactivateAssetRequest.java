package com.proj.server.asset;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeactivateAssetRequest(
        @NotBlank @Size(max = 60) String reference) {}
