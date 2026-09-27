package com.proj.server.location;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record CreateLocationRequest(
        @NotNull LocationType type,
        UUID parentId,
        @NotBlank @Size(max = 200) String name,
        Integer sortOrder) {
    public CreateLocationRequest {
        name = name == null ? null : name.strip();
    }
}
