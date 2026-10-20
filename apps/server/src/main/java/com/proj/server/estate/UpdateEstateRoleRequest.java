package com.proj.server.estate;

import jakarta.validation.constraints.NotNull;

public record UpdateEstateRoleRequest(@NotNull EstateRole role) {}
