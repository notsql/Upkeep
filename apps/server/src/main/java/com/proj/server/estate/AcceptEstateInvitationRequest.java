package com.proj.server.estate;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record AcceptEstateInvitationRequest(
        @NotNull @Positive Integer expectedRoleVersion) {}
