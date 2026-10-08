package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(requiredProperties = {"estateIds"})
public record AcceptedInvitationsResponse(List<UUID> estateIds) {}
