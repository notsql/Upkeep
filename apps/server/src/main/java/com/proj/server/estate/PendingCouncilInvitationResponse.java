package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "estateId", "estateName", "expiresAt", "role"})
public record PendingCouncilInvitationResponse(
        UUID id, UUID estateId, String estateName, OffsetDateTime expiresAt, EstateRole role) {
    public PendingCouncilInvitationResponse(UUID id, UUID estateId, String estateName, OffsetDateTime expiresAt) {
        this(id, estateId, estateName, expiresAt, EstateRole.COUNCIL);
    }
}
