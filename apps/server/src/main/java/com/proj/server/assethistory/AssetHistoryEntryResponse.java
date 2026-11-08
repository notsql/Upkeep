package com.proj.server.assethistory;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "sourceId",
            "kind",
            "title",
            "summary",
            "occurredOn",
            "occurredAt",
            "recordedAt",
            "details"
        })
public record AssetHistoryEntryResponse(
        String id,
        UUID sourceId,
        Kind kind,
        String title,
        @Schema(nullable = true) String summary,
        @Schema(nullable = true) LocalDate occurredOn,
        @Schema(nullable = true) OffsetDateTime occurredAt,
        OffsetDateTime recordedAt,
        AssetHistoryDetails details) {
    public enum Kind {
        MAINTENANCE,
        WORK_ORDER_COMPLETED,
        CONDITION,
        INSPECTION,
        LIFECYCLE,
        INVOICE,
        SERVICE_REPORT
    }
}
