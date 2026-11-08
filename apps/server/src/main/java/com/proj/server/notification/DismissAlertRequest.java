package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"reason"})
public record DismissAlertRequest(
        @Schema(description = "1 to 500 characters after trimming")
        String reason) {}
