package com.proj.server.document;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "id",
            "estateId",
            "documentType",
            "originalFilename",
            "contentType",
            "sizeBytes",
            "createdAt",
            "canDelete"
        })
public record DocumentResponse(
        UUID id,
        UUID estateId,
        DocumentType documentType,
        String originalFilename,
        String contentType,
        int sizeBytes,
        OffsetDateTime createdAt,
        boolean canDelete) {}
