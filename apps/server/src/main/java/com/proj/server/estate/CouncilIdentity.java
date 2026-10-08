package com.proj.server.estate;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface CouncilIdentity {
    Person user(String userId);

    Invitation send(UUID requestId, String email, String inviterUserId);

    Invitation invitation(String invitationId);

    record Person(String id, String name, String email, boolean verified) {}

    record Invitation(
            String id,
            String email,
            String state,
            OffsetDateTime expiresAt,
            String acceptedUserId,
            OffsetDateTime acceptedAt) {}
}
