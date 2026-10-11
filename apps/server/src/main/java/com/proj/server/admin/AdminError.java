package com.proj.server.admin;

import io.swagger.v3.oas.annotations.media.Schema;

public record AdminError(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {}
