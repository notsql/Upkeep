package com.proj.server.estate;

import com.fasterxml.jackson.annotation.JsonCreator;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public record CouncilInvitationRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @Schema(defaultValue = "COUNCIL") EstateRole role,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        UUID customRoleId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        Integer expectedRoleVersion) {
    public CouncilInvitationRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
        role = role == null ? EstateRole.COUNCIL : role;
        EstateRoleSelection.validate(role, customRoleId, expectedRoleVersion);
    }

    public CouncilInvitationRequest(String email, EstateRole role) {
        this(email, role, null, null);
    }

    public CouncilInvitationRequest(String email) {
        this(email, EstateRole.COUNCIL);
    }

    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static CouncilInvitationRequest fromJson(JsonNode body) {
        if (!body.isObject()) throw new IllegalArgumentException("Expected an invitation object.");
        var email = body.get("email");
        if (email != null && !email.isNull() && !email.isTextual())
            throw new IllegalArgumentException("Email must be text.");
        EstateRole role = EstateRole.COUNCIL;
        if (body.has("role")) {
            var offered = body.get("role");
            if (offered == null || !offered.isTextual())
                throw new IllegalArgumentException("Choose an invitation role.");
            role = EstateRole.valueOf(offered.asText());
        }
        var custom = body.get("customRoleId");
        UUID customId = custom == null || custom.isNull() ? null : UUID.fromString(custom.asText());
        var version = body.get("expectedRoleVersion");
        Integer expected = null;
        if (version != null && !version.isNull()) {
            if (!version.isIntegralNumber() || version.asLong() > Integer.MAX_VALUE || version.asLong() < 1)
                throw new IllegalArgumentException("Choose a positive role version.");
            expected = version.asInt();
        }
        return new CouncilInvitationRequest(
                email == null || email.isNull() ? null : email.asText(), role, customId, expected);
    }
}
