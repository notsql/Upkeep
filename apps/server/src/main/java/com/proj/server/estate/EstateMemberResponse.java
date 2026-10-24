package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "userId",
            "name",
            "email",
            "canInviteMembers",
            "role",
            "owner",
            "customRoleId",
            "customRoleName"
        })
public record EstateMemberResponse(
        String userId,
        String name,
        String email,
        boolean canInviteMembers,

        @Schema(allowableValues = {"MANAGER", "COUNCIL", "RESIDENT", "CREW", "MEMBER", "CUSTOM"})
        String role,

        boolean owner,
        @Schema(nullable = true) UUID customRoleId,
        @Schema(nullable = true) String customRoleName) {
    public EstateMemberResponse(
            String userId, String name, String email, boolean canInviteMembers, String role, boolean owner) {
        this(userId, name, email, canInviteMembers, role, owner, null, null);
    }

    public EstateMemberResponse(String userId, String name, String email, boolean canInviteMembers) {
        this(userId, name, email, canInviteMembers, "COUNCIL", false);
    }
}
