package com.proj.server.access;

import com.proj.server.resident.ResidentContextResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "canEnterWorkspace",
            "canCreateEstate",
            "canAccessPlatformAdmin",
            "hasResidentMembership",
            "canSubmitReport",
            "residentEstate",
            "estates"
        })
public record AppAccessResponse(
        boolean canEnterWorkspace,
        boolean canCreateEstate,
        boolean canAccessPlatformAdmin,
        boolean hasResidentMembership,
        boolean canSubmitReport,
        @Schema(nullable = true) ResidentContextResponse.EstateLabel residentEstate,
        List<EstateAccessResponse> estates) {
    @Schema(
            requiredProperties = {
                "estateId",
                "role",
                "canViewManagement",
                "canManageEstate",
                "canViewAssets",
                "canInviteMembers",
                "canManageInvitationPermissions"
            })
    public record EstateAccessResponse(
            UUID estateId,

            @Schema(allowableValues = {"OWNER", "MEMBER", "COUNCIL", "RESIDENT"})
            String role,

            boolean canViewManagement,
            boolean canManageEstate,
            boolean canViewAssets,
            boolean canInviteMembers,
            boolean canManageInvitationPermissions) {}
}
