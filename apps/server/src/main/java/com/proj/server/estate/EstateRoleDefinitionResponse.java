package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "name",
            "description",
            "permissions",
            "createdAt",
            "updatedAt",
            "version",
            "canEdit",
            "canDelete"
        })
public record EstateRoleDefinitionResponse(
        UUID id,
        UUID estateId,
        String name,
        @Schema(nullable = true) String description,
        List<EstatePermissionCode> permissions,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        int version,
        boolean canEdit,
        boolean canDelete) {}
