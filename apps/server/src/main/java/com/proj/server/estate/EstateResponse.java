package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "name", "code", "address", "postalCode", "createdAt", "updatedAt"})
public record EstateResponse(
        UUID id,
        String name,
        String code,
        String address,
        String postalCode,
        @Schema(nullable = true) String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        @Schema(nullable = true) OffsetDateTime deactivatedAt) {}
