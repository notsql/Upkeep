package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(requiredProperties = {"locationId", "expectedLocationId"})
public record RelocateReportRequest(
        @NotNull UUID locationId, @NotNull UUID expectedLocationId) {}
