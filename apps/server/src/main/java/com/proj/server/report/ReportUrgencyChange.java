package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "version",
            "fromUrgency",
            "toUrgency",
            "fromIsSafety",
            "toIsSafety",
            "changedByName",
            "changedAt"
        })
public record ReportUrgencyChange(
        UUID id,
        int version,
        ReportUrgency fromUrgency,
        ReportUrgency toUrgency,
        boolean fromIsSafety,
        boolean toIsSafety,
        @Schema(types = {"string", "null"}) String changedByName,
        OffsetDateTime changedAt) {}
