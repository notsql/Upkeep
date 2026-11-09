package com.proj.server.reading;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@io.swagger.v3.oas.annotations.media.Schema(
        requiredProperties = {"recordNumber", "startingLineNumber", "outcome", "origin", "issues"})
public record ReadingImportRowResponse(
        int recordNumber,
        int startingLineNumber,
        ReadingImportOutcome outcome,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        UUID readingId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        ReadingSource source,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        UUID assetId,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        String metric,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        OffsetDateTime measuredAt,

        @io.swagger.v3.oas.annotations.media.Schema(nullable = true)
        String valueText,

        Map<String, String> origin,
        List<ReadingImportIssue> issues) {}
