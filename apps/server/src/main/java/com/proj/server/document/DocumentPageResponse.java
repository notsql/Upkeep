package com.proj.server.document;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"items", "nextCursor"})
public record DocumentPageResponse(
        List<DocumentResponse> items,
        @Schema(nullable = true) String nextCursor) {}
