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
                "canViewReadings",
                "canViewEstateDetails",
                "canViewInspectionResults",
                "canCreateInspectionResults",
                "canInviteMembers",
                "canManageInvitationPermissions",
                "canViewFaultReports",
                "canRelocateFaultReports",
                "canViewWorkOrders",
                "canCreateWorkOrders",
                "canUpdateWorkOrders",
                "customRoleId",
                "customRoleName",
                "canCreateLocations",
                "canCreateFloors",
                "canEditLocations",
                "canViewEstateRoles",
                "canCreateRoles",
                "canEditRoles",
                "canDeleteRoles",
                "canReassignRoles",
                "canViewEstateInvitations",
                "canViewDocuments",
                "canUploadDocuments"
            })
    public record EstateAccessResponse(
            UUID estateId,
            String estateName,

            @Schema(allowableValues = {"MANAGER", "MEMBER", "COUNCIL", "RESIDENT", "CREW", "CUSTOM"})
            String role,

            boolean canViewManagement,
            boolean canManageEstate,
            boolean canViewAssets,
            boolean canViewReadings,
            boolean canViewEstateDetails,
            boolean canViewInspectionResults,
            boolean canCreateInspectionResults,
            boolean canInviteMembers,
            boolean canManageInvitationPermissions,
            boolean canViewFaultReports,
            boolean canRelocateFaultReports,
            boolean canViewWorkOrders,
            boolean canCreateWorkOrders,
            boolean canUpdateWorkOrders,
            @Schema(nullable = true) UUID customRoleId,
            @Schema(nullable = true) String customRoleName,
            boolean canCreateLocations,
            boolean canCreateFloors,
            boolean canEditLocations,
            boolean canViewEstateRoles,
            boolean canCreateRoles,
            boolean canEditRoles,
            boolean canDeleteRoles,
            boolean canReassignRoles,
            boolean canViewEstateInvitations,
            boolean canViewDocuments,
            boolean canUploadDocuments) {}
}
