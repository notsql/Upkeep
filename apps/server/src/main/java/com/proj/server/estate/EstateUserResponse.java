package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"estateId", "name", "code", "active", "owner", "granted"})
public record EstateUserResponse(
        UUID estateId, String name, String code, boolean active, boolean owner, boolean granted) {}
