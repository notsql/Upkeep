package com.proj.server.estate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeactivateEstateRequest(
        @NotBlank @Size(max = 50) String code) {}
