package com.proj.server.estate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record EstateRequest(
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 500) String address,
        @NotBlank @Size(max = 20) String postalCode,
        @Size(max = 2000) String description) {
    public EstateRequest {
        name = name == null ? null : name.strip();
        code = code == null ? null : code.strip().toUpperCase(Locale.ROOT);
        address = address == null ? null : address.strip();
        postalCode = postalCode == null ? null : postalCode.strip();
        description = description == null || description.isBlank() ? null : description.strip();
    }
}
