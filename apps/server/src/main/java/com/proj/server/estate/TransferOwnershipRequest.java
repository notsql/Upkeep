package com.proj.server.estate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TransferOwnershipRequest(
        @NotBlank @Size(max = 255) String newOwnerUserId) {}
