package com.proj.server.notification;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "page", "size", "total"})
public record NotificationPageResponse(List<NotificationResponse> items, int page, int size, long total) {}
