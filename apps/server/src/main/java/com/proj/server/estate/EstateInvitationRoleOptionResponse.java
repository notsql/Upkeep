package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(requiredProperties = {"role", "label", "customRoleId", "customRoleVersion", "permissions"})
public record EstateInvitationRoleOptionResponse(
        EstateRole role,
        String label,
        @Schema(nullable = true) UUID customRoleId,
        @Schema(nullable = true) Integer customRoleVersion,
        @Schema(nullable = true) List<EstatePermissionResponse> permissions) {}
