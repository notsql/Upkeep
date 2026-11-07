package com.proj.server.reading;

import java.util.List;

@io.swagger.v3.oas.annotations.media.Schema(requiredProperties = {"items", "page", "size", "totalItems"})
public record ReadingImportRowPage(List<ReadingImportRowResponse> items, int page, int size, long totalItems) {}
