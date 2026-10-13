package com.proj.server.dashboard;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import java.util.UUID;

@Schema(
        requiredProperties = {
            "accessibleEstateCount",
            "activeEstateCount",
            "inactiveEstateCount",
            "activeOwnedEstateCount",
            "totalActiveAssets",
            "councilMemberCount",
            "conditionCounts",
            "affectedEstateCount",
            "estatesNeedingAttention"
        })
public record DashboardSummaryResponse(
        int accessibleEstateCount,
        int activeEstateCount,
        int inactiveEstateCount,
        int activeOwnedEstateCount,
        long councilMemberCount,
        long totalActiveAssets,
        DashboardConditionCounts conditionCounts,
        int affectedEstateCount,
        List<DashboardEstateSummary> estatesNeedingAttention) {
    @Schema(requiredProperties = {"good", "needsAttention", "faulty", "unassessed"})
    public record DashboardConditionCounts(long good, long needsAttention, long faulty, long unassessed) {}

    @Schema(
            requiredProperties = {
                "estateId",
                "estateName",
                "estateCode",
                "totalActiveAssets",
                "needsAttentionCount",
                "faultyCount"
            })
    public record DashboardEstateSummary(
            UUID estateId,
            String estateName,
            String estateCode,
            long totalActiveAssets,
            long needsAttentionCount,
            long faultyCount) {}
}
