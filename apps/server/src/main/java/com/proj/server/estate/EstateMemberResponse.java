package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"userId", "name", "email", "canInviteMembers", "role", "owner"})
public record EstateMemberResponse(
        String userId,
        String name,
        String email,
        boolean canInviteMembers,

        @Schema(allowableValues = {"MANAGER", "COUNCIL", "RESIDENT", "CREW", "MEMBER"})
        String role,

        boolean owner) {
    public EstateMemberResponse(String userId, String name, String email, boolean canInviteMembers) {
        this(userId, name, email, canInviteMembers, "COUNCIL", false);
    }
}
