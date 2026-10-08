package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "estateId", "estateName", "expiresAt"})
public record PendingCouncilInvitationResponse(UUID id, UUID estateId, String estateName, OffsetDateTime expiresAt) {}
