package com.proj.server.estate;

import jakarta.validation.constraints.NotNull;

public record InvitationPermissionRequest(@NotNull Boolean canInviteMembers) {}
