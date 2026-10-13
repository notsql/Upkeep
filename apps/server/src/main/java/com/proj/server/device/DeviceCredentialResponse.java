package com.proj.server.device;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"deviceId", "apiKey", "issuedAt"})
public record DeviceCredentialResponse(
        UUID deviceId,

        @Schema(description = "The device's API key. Returned only here, once; it is never stored or shown again.")
        String apiKey,

        OffsetDateTime issuedAt) {}
