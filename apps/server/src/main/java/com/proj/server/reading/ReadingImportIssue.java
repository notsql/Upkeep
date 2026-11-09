package com.proj.server.reading;

@io.swagger.v3.oas.annotations.media.Schema(requiredProperties = {"field", "code", "reason"})
public record ReadingImportIssue(String field, String code, String reason) {}
