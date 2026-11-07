package com.proj.server.report;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/** The original a report is linked to. Only SUSPECTED or CONFIRMED links appear. */
@Schema(requiredProperties = {"reportId", "title", "state"})
public record DuplicateOf(UUID reportId, String title, DuplicateState state) {}
