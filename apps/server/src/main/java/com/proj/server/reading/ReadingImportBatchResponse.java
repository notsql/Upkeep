package com.proj.server.reading;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@io.swagger.v3.oas.annotations.media.Schema(
        requiredProperties = {
            "id",
            "estateId",
            "submissionId",
            "sourceLabel",
            "originalFilename",
            "fileHash",
            "sizeBytes",
            "mapping",
            "preset",
            "assetLookupMode",
            "parserVersion",
            "uploaderUserId",
            "createdAt",
            "status",
            "totalRows",
            "importedRows",
            "duplicateRows",
            "invalidRows",
            "warningRows"
        })
public record ReadingImportBatchResponse(
        UUID id,
        UUID estateId,
        UUID submissionId,
        String sourceLabel,
        String originalFilename,
        String fileHash,
        int sizeBytes,
        Map<String, String> mapping,
        ReadingImportPreset preset,
        String assetLookupMode,
        String parserVersion,
        String uploaderUserId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        String uploaderName,

        OffsetDateTime createdAt,
        ReadingImportStatus status,
        int totalRows,
        int importedRows,
        int duplicateRows,
        int invalidRows,
        int warningRows,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        String rollbackUserId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        OffsetDateTime rollbackAt,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        String rollbackReason,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        Integer removedCount) {}
