package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;

public record EstateError(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {}
