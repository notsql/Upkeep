package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "estateName",
            "expiresAt",
            "role",
            "customRoleId",
            "customRoleVersion",
            "customRoleName",
            "customPermissions"
        })
public record PendingCouncilInvitationResponse(
        UUID id,
        UUID estateId,
        String estateName,
        OffsetDateTime expiresAt,
        EstateRole role,
        @Schema(nullable = true) UUID customRoleId,
        @Schema(nullable = true) Integer customRoleVersion,
        @Schema(nullable = true) String customRoleName,
        @Schema(nullable = true) List<EstatePermissionResponse> customPermissions) {

    public PendingCouncilInvitationResponse(
            UUID id, UUID estateId, String estateName, OffsetDateTime expiresAt, EstateRole role) {
        this(id, estateId, estateName, expiresAt, role, null, null, null, null);
    }

    public PendingCouncilInvitationResponse(UUID id, UUID estateId, String estateName, OffsetDateTime expiresAt) {
        this(id, estateId, estateName, expiresAt, EstateRole.COUNCIL);
    }
}
