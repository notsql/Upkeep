package com.proj.server.report;

import com.proj.server.resident.IssueReportSummaryResponse.ReportLocation;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"reportId", "title", "location", "state", "createdAt"})
public record LinkedDuplicate(
        UUID reportId, String title, ReportLocation location, DuplicateState state, OffsetDateTime createdAt) {}
