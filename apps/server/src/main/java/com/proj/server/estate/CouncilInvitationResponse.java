package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "email",
            "status",
            "expiresAt",
            "role",
            "customRoleId",
            "customRoleVersion",
            "customRoleName",
            "customPermissions"
        })
public record CouncilInvitationResponse(
        UUID id,
        UUID estateId,
        String email,
        String status,
        @Schema(nullable = true) OffsetDateTime expiresAt,
        EstateRole role,
        @Schema(nullable = true) UUID customRoleId,
        @Schema(nullable = true) Integer customRoleVersion,
        @Schema(nullable = true) String customRoleName,
        @Schema(nullable = true) List<EstatePermissionResponse> customPermissions) {

    public CouncilInvitationResponse(
            UUID id, UUID estateId, String email, String status, OffsetDateTime expiresAt, EstateRole role) {
        this(id, estateId, email, status, expiresAt, role, null, null, null, null);
    }

    public CouncilInvitationResponse(UUID id, UUID estateId, String email, String status, OffsetDateTime expiresAt) {
        this(id, estateId, email, status, expiresAt, EstateRole.COUNCIL);
    }
}
