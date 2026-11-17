import { Badge } from "@proj/ui/components/badge";
import {
  badgeVariantFor,
  reportStatusLabel,
  reportStatusTone,
  type StatusTone,
  type WorkOrderStatus,
  workOrderStatusLabel,
  workOrderStatusTone,
} from "@/lib/status-tone";

function isWorkOrderStatus(status: string): status is WorkOrderStatus {
  return Object.hasOwn(workOrderStatusTone, status);
}

function isReportStatus(
  status: string
): status is keyof typeof reportStatusTone {
  return Object.hasOwn(reportStatusTone, status);
}

function described(status: string): { label: string; tone?: StatusTone } {
  if (isWorkOrderStatus(status)) {
    return {
      label: workOrderStatusLabel[status],
      tone: workOrderStatusTone[status],
    };
  }
  if (isReportStatus(status)) {
    return { label: reportStatusLabel[status], tone: reportStatusTone[status] };
  }
  return { label: status };
}

/**
 * A report or work-order status, labelled and toned (shared by both). Report
 * status is typed as a plain string, so an unknown value shows as-is, outlined.
 */
export function WorkOrderStatusBadge({ status }: { status: string }) {
  const { label, tone } = described(status);
  return (
    <Badge className="w-fit" variant={badgeVariantFor(tone)}>
      {label}
    </Badge>
  );
}
