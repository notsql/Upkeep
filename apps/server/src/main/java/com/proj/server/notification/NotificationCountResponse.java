package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(requiredProperties = {"unread"})
public record NotificationCountResponse(int unread) {}
