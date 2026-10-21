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
            "residentEstates",
            "estates"
        })
public record AppAccessResponse(
        boolean canEnterWorkspace,
        boolean canCreateEstate,
        boolean canAccessPlatformAdmin,
        boolean hasResidentMembership,
        boolean canSubmitReport,
        List<ResidentContextResponse.EstateLabel> residentEstates,
        List<EstateAccessResponse> estates) {
    @Schema(
            requiredProperties = {
                "estateId",
                "estateName",
                "role",
                "canViewManagement",
                "canManageEstate",
                "canViewAssets",
                "canInviteMembers",
                "canManageInvitationPermissions",
                "canViewFaultReports",
                "canRelocateFaultReports"
            })
    public record EstateAccessResponse(
            UUID estateId,
            String estateName,

            @Schema(allowableValues = {"MANAGER", "MEMBER", "COUNCIL", "RESIDENT", "CREW"})
            String role,

            boolean canViewManagement,
            boolean canManageEstate,
            boolean canViewAssets,
            boolean canInviteMembers,
            boolean canManageInvitationPermissions,
            boolean canViewFaultReports,
            boolean canRelocateFaultReports) {}
}
