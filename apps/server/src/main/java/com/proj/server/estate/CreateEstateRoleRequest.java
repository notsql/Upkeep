package com.proj.server.estate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateEstateRoleRequest(
        @NotBlank @Size(max = 40) String name,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true) @Size(max = 500)
        String description,

        @NotEmpty List<@NotNull EstatePermissionCode> permissions) {
    public CreateEstateRoleRequest {
        name = name == null ? null : name.strip();
        description = description == null || description.isBlank() ? null : description.strip();
    }
}
