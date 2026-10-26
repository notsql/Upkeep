package com.proj.server.inspection;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "assetId",
            "locationId",
            "locationPath",
            "outcome",
            "inspectedOn",
            "notes",
            "recordedByUserId",
            "recordedByName",
            "createdAt",
            "photos",
            "workOrder"
        })
public record InspectionResultResponse(
        UUID id,
        UUID estateId,
        UUID assetId,
        UUID locationId,
        String locationPath,
        InspectionOutcome outcome,
        LocalDate inspectedOn,
        @Schema(nullable = true) String notes,
        String recordedByUserId,
        @Schema(nullable = true) String recordedByName,
        OffsetDateTime createdAt,
        List<InspectionPhotoResponse> photos,

        @Schema(
                nullable = true,
                types = {"object", "null"})
        InspectionWorkOrderResponse workOrder) {
    @Schema(requiredProperties = {"id", "contentType"})
    public record InspectionPhotoResponse(UUID id, String contentType) {}

    @Schema(
            types = {"object", "null"},
            requiredProperties = {"id", "reference"})
    public record InspectionWorkOrderResponse(UUID id, String reference) {}
}
