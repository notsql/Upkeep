package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"estateId", "name", "code", "active", "owner", "granted", "canManageGrant"})
public record EstateUserResponse(
        UUID estateId,
        String name,
        String code,
        boolean active,
        boolean owner,
        boolean granted,

        @Schema(
                nullable = true,
                allowableValues = {"MEMBER", "COUNCIL", "RESIDENT"})
        String membershipRole,

        boolean canManageGrant) {
    public EstateUserResponse(UUID estateId, String name, String code, boolean active, boolean owner, boolean granted) {
        this(estateId, name, code, active, owner, granted, granted ? "MEMBER" : null, true);
    }
}
