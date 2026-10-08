package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "estateId", "email", "status", "expiresAt"})
public record CouncilInvitationResponse(
        UUID id,
        UUID estateId,
        String email,
        String status,
        @Schema(nullable = true) OffsetDateTime expiresAt) {}
