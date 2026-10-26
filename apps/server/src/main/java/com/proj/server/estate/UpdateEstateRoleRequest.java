package com.proj.server.estate;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record UpdateEstateRoleRequest(
        @NotNull EstateRole role,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        UUID customRoleId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        Integer expectedRoleVersion) {
    public UpdateEstateRoleRequest {
        EstateRoleSelection.validate(role, customRoleId, expectedRoleVersion);
    }

    public UpdateEstateRoleRequest(EstateRole role) {
        this(role, null, null);
    }
}
