package com.proj.server.assethistory;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.proj.server.document.DocumentResponse;
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "kind")
@JsonSubTypes({
    @JsonSubTypes.Type(value = AssetHistoryDetails.Maintenance.class, name = "MAINTENANCE"),
    @JsonSubTypes.Type(value = AssetHistoryDetails.Completion.class, name = "COMPLETION"),
    @JsonSubTypes.Type(value = AssetHistoryDetails.Condition.class, name = "CONDITION"),
    @JsonSubTypes.Type(value = AssetHistoryDetails.Inspection.class, name = "INSPECTION"),
    @JsonSubTypes.Type(value = AssetHistoryDetails.Lifecycle.class, name = "LIFECYCLE"),
    @JsonSubTypes.Type(value = AssetHistoryDetails.Document.class, name = "DOCUMENT")
})
@Schema(
        discriminatorProperty = "kind",
        oneOf = {
            AssetHistoryDetails.Maintenance.class,
            AssetHistoryDetails.Completion.class,
            AssetHistoryDetails.Condition.class,
            AssetHistoryDetails.Inspection.class,
            AssetHistoryDetails.Lifecycle.class,
            AssetHistoryDetails.Document.class
        },
        discriminatorMapping = {
            @DiscriminatorMapping(value = "MAINTENANCE", schema = AssetHistoryDetails.Maintenance.class),
            @DiscriminatorMapping(value = "COMPLETION", schema = AssetHistoryDetails.Completion.class),
            @DiscriminatorMapping(value = "CONDITION", schema = AssetHistoryDetails.Condition.class),
            @DiscriminatorMapping(value = "INSPECTION", schema = AssetHistoryDetails.Inspection.class),
            @DiscriminatorMapping(value = "LIFECYCLE", schema = AssetHistoryDetails.Lifecycle.class),
            @DiscriminatorMapping(value = "DOCUMENT", schema = AssetHistoryDetails.Document.class)
        })
public sealed interface AssetHistoryDetails {
    enum Type {
        MAINTENANCE,
        COMPLETION,
        CONDITION,
        INSPECTION,
        LIFECYCLE,
        DOCUMENT
    }

    enum Origin {
        HUMAN,
        ANOMALY_MODEL
    }

    Type kind();

    @Schema(
            name = "HistoryMaintenanceDetails",
            requiredProperties = {"kind", "type", "notes"})
    record Maintenance(
            Type kind,
            String type,
            String notes,
            @Schema(nullable = true) String findings,
            @Schema(nullable = true) String workPerformed,
            @Schema(nullable = true) String serviceProvider,
            @Schema(nullable = true) String partsReplaced,
            @Schema(nullable = true) Integer downtimeMinutes,
            @Schema(nullable = true) String labourCost,
            @Schema(nullable = true) String partsCost,
            @Schema(nullable = true) String otherCost,
            @Schema(nullable = true) String totalCost)
            implements AssetHistoryDetails {}

    @Schema(
            name = "HistoryCompletionDetails",
            requiredProperties = {
                "kind",
                "workOrderId",
                "reference",
                "findings",
                "workPerformed",
                "currency",
                "canViewWorkOrder"
            })
    record Completion(
            Type kind,
            UUID workOrderId,
            String reference,
            String findings,
            String workPerformed,
            @Schema(nullable = true) String partsUsed,
            @Schema(nullable = true) String labourCost,
            @Schema(nullable = true) String partsCost,
            @Schema(nullable = true) String totalCost,
            String currency,
            @Schema(nullable = true) Integer downtimeMinutes,
            @Schema(nullable = true) OffsetDateTime editedAt,
            boolean canViewWorkOrder)
            implements AssetHistoryDetails {}

    @Schema(
            name = "HistoryConditionDetails",
            requiredProperties = {"kind", "condition", "assessedOn", "notes", "origin", "sourceLabel"})
    record Condition(Type kind, String condition, LocalDate assessedOn, String notes, Origin origin, String sourceLabel)
            implements AssetHistoryDetails {}

    @Schema(
            name = "HistoryInspectionDetails",
            requiredProperties = {"kind", "outcome", "inspectedOn", "locationPath", "canViewInspection"})
    record Inspection(
            Type kind,
            String outcome,
            LocalDate inspectedOn,
            @Schema(nullable = true) String notes,
            String locationPath,
            boolean canViewInspection)
            implements AssetHistoryDetails {}

    @Schema(
            name = "HistoryLifecycleDetails",
            requiredProperties = {"kind", "action", "lifecycleVersion"})
    record Lifecycle(
            Type kind,
            String action,
            @Schema(nullable = true) LocalDate previousRetiredOn,
            @Schema(nullable = true) String previousRetirementReason,
            @Schema(nullable = true) LocalDate retiredOn,
            @Schema(nullable = true) String retirementReason,
            int lifecycleVersion)
            implements AssetHistoryDetails {}

    @Schema(
            name = "HistoryDocumentDetails",
            requiredProperties = {"kind", "document"})
    record Document(Type kind, DocumentResponse document) implements AssetHistoryDetails {}
}
