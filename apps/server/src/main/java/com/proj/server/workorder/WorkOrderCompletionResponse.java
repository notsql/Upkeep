package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.UUID;

@Schema(requiredProperties = {"id", "findings", "workPerformed", "currency", "completedByUserId", "completedAt"})
public record WorkOrderCompletionResponse(
        UUID id,
        String findings,
        String workPerformed,
        String partsUsed,
        String labourCost,
        String partsCost,
        String totalCost,
        String currency,
        Integer downtimeMinutes,
        String completedByUserId,
        String completedByName,
        OffsetDateTime completedAt,
        String editedByUserId,
        String editedByName,
        OffsetDateTime editedAt) {
    static WorkOrderCompletionResponse from(com.proj.server.db.tables.records.WorkordercompletionRecord row) {
        if (row == null || row.getId() == null) return null;
        var labour = row.getLabourcost();
        var parts = row.getPartscost();
        return new WorkOrderCompletionResponse(
                row.getId(),
                row.getFindings(),
                row.getWorkperformed(),
                row.getPartsused(),
                labour == null ? null : labour.toPlainString(),
                parts == null ? null : parts.toPlainString(),
                labour == null || parts == null ? null : labour.add(parts).toPlainString(),
                row.getCurrency(),
                row.getDowntimeminutes(),
                row.getCompletedbyuserid(),
                row.getCompletedbyname(),
                row.getCompletedat(),
                row.getEditedbyuserid(),
                row.getEditedbyname(),
                row.getEditedat());
    }
}
