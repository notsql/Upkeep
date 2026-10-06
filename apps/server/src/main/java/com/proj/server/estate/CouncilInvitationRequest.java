package com.proj.server.estate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record CouncilInvitationRequest(
        @NotBlank @Email @Size(max = 254) String email) {
    public CouncilInvitationRequest {
        email = email == null ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
