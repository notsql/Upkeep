import type { components } from "@proj/api/schema";
import type { Badge } from "@proj/ui/components/badge";
import type { ComponentProps } from "react";

type Schemas = components["schemas"];

/**
 * The one place a status, urgency or outcome is given a colour. Every
 * mapping below resolves to a tone, and each tone to one Badge variant and
 * one dot colour, so the same meaning looks the same on every screen.
 */
export type StatusTone =
  | "success"
  | "warning"
  | "info"
  | "danger"
  | "neutral"
  | "muted";

export type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

export const statusToneBadgeVariant = {
  success: "success",
  warning: "warning",
  info: "info",
  danger: "destructive",
  neutral: "outline",
  muted: "secondary",
} as const satisfies Record<StatusTone, BadgeVariant>;

/** The Badge variant for a tone; an unknown tone (newer server) is outline. */
export function badgeVariantFor(tone: StatusTone | undefined): BadgeVariant {
  if (tone && Object.hasOwn(statusToneBadgeVariant, tone)) {
    return statusToneBadgeVariant[tone];
  }
  return "outline";
}

export const statusDotClassName = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground/50",
  muted: "bg-muted-foreground/30",
} as const satisfies Record<StatusTone, string>;

export type ReportUrgency =
  Schemas["EstateIssueReportDetailResponse"]["urgency"];
export const reportUrgencyTone = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "danger",
} as const satisfies Record<ReportUrgency, StatusTone>;

/** Shared by reports and work orders. */
export type WorkOrderStatus = Schemas["WorkOrderResponse"]["status"];
export const workOrderStatusTone = {
  OPEN: "neutral",
  ASSIGNED: "info",
  IN_PROGRESS: "warning",
  CLOSED: "success",
} as const satisfies Record<WorkOrderStatus, StatusTone>;
export const workOrderStatusLabel = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  CLOSED: "Closed",
} as const satisfies Record<WorkOrderStatus, string>;

/** `UNASSESSED` also stands in for a null condition. */
export type AssetCondition =
  | Schemas["AnomalyAlertDetails"]["condition"]
  | "UNASSESSED";
export const assetConditionTone = {
  GOOD: "success",
  NEEDS_ATTENTION: "warning",
  FAULTY: "danger",
  UNASSESSED: "neutral",
} as const satisfies Record<AssetCondition, StatusTone>;

export type DeviceStatus = Schemas["DeviceResponse"]["status"];
export const deviceStatusTone = {
  ONLINE: "success",
  OFFLINE: "danger",
  AWAITING_FIRST_READING: "info",
  DEACTIVATED: "muted",
} as const satisfies Record<DeviceStatus, StatusTone>;

/** Asset `ACTIVE | RETIRED`, plus `INACTIVE` for the boolean `inactive` flag. */
export type Lifecycle =
  | Schemas["AssetHistorySummaryResponse"]["status"]
  | "INACTIVE";
export const lifecycleTone = {
  ACTIVE: "success",
  RETIRED: "muted",
  INACTIVE: "muted",
} as const satisfies Record<Lifecycle, StatusTone>;

export type InspectionOutcome = Schemas["CheckResultResponse"]["outcome"];
export const inspectionOutcomeTone = {
  PASS: "success",
  FAIL: "danger",
} as const satisfies Record<InspectionOutcome, StatusTone>;

export type InspectionCheckStatus =
  Schemas["InspectionCheckResponse"]["status"];
/** A done check that failed is a warning, not a danger: the work is done. */
export function inspectionCheckTone(
  status: InspectionCheckStatus,
  outcome: InspectionOutcome | null | undefined
): StatusTone {
  if (status === "OVERDUE") {
    return "danger";
  }
  if (status === "DUE") {
    return "info";
  }
  return outcome === "FAIL" ? "warning" : "success";
}

export type NotificationType = Schemas["NotificationResponse"]["type"];
export const notificationTypeTone = {
  ANOMALY: "danger",
  SERVICE_DUE: "info",
  REPAIR_PREDICTED: "warning",
  CHECK_REQUESTED: "info",
  CHECK_FAILED: "danger",
} as const satisfies Record<NotificationType, StatusTone>;

export type AlertResponse = Schemas["AnomalyAlertDetails"]["response"];
export const alertResponseTone = {
  NONE: "warning",
  ACKNOWLEDGED: "success",
  DISMISSED: "muted",
} as const satisfies Record<AlertResponse, StatusTone>;

/** A rejected duplicate shows no badge, so it has no tone. */
export type DuplicateReportState = Exclude<
  Schemas["DuplicateOf"]["state"],
  "REJECTED"
>;
export const duplicateReportTone = {
  SUSPECTED: "warning",
  CONFIRMED: "muted",
} as const satisfies Record<DuplicateReportState, StatusTone>;

export type ReadingImportOutcome =
  Schemas["ReadingImportRowResponse"]["outcome"];
export const readingImportOutcomeTone = {
  IMPORTED: "success",
  DUPLICATE: "muted",
  INVALID: "danger",
} as const satisfies Record<ReadingImportOutcome, StatusTone>;

export type TelemetryItemStatus = Schemas["TelemetryItemResult"]["status"];
export const telemetryItemStatusTone = {
  CREATED: "success",
  ALREADY_STORED: "muted",
  INVALID: "danger",
  CONFLICT: "warning",
} as const satisfies Record<TelemetryItemStatus, StatusTone>;

export type ReadingFlag = Schemas["ReadingFlagResponse"]["type"];
export const readingFlagTone = {
  ANOMALY: "danger",
  OUT_OF_RANGE: "danger",
  GAP: "warning",
  DUPLICATE_TIMESTAMP: "warning",
} as const satisfies Record<ReadingFlag, StatusTone>;

export type ReadingSuspicionState = Schemas["DuplicateOf"]["state"];
export const readingSuspicionTone = {
  SUSPECTED: "warning",
  CONFIRMED: "danger",
  REJECTED: "muted",
} as const satisfies Record<ReadingSuspicionState, StatusTone>;

/** Failure-risk and service-interval due states: check status or due basis. */
export type ServiceDue =
  | Exclude<InspectionCheckStatus, "DONE">
  | Extract<Schemas["InspectionCheckResponse"]["dueBasis"], "NEVER_INSPECTED">;
export const serviceDueTone = {
  OVERDUE: "danger",
  DUE: "warning",
  NEVER_INSPECTED: "info",
} as const satisfies Record<ServiceDue, StatusTone>;

/** Council membership: a pending invitation or an active member. */
export type Membership = "PENDING" | "ACTIVE";
export const invitationTone = {
  PENDING: "info",
  ACTIVE: "success",
} as const satisfies Record<Membership, StatusTone>;

export type WorkOrderType = Schemas["CreateAssetEventRequest"]["type"];
export const workOrderTypeTone = {
  BREAKDOWN_REPAIR: "warning",
  PREVENTIVE: "info",
} as const satisfies Record<WorkOrderType, StatusTone>;
