package com.proj.server.reading;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RevertReadingImportRequest(
        @NotBlank @Size(max = 2000) String reason) {}
