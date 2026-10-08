package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"userId", "name", "email", "canInviteMembers"})
public record EstateMemberResponse(String userId, String name, String email, boolean canInviteMembers) {}
