package com.proj.server.inspectionlist;

import com.proj.server.inspection.InspectionOutcome;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.UUID;

/** The inspection result that completed a check. */
@Schema(requiredProperties = {"id", "outcome", "inspectedOn"})
public record CheckResultResponse(UUID id, InspectionOutcome outcome, LocalDate inspectedOn) {}
