package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;

public record AcknowledgeAlertRequest(
        @Schema(nullable = true, description = "Optional, at most 500 characters after trimming")
        String reason) {}
