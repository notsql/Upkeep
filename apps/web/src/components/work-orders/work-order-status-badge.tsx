import { Badge } from "@proj/ui/components/badge";
import {
  badgeVariantFor,
  type WorkOrderStatus,
  workOrderStatusLabel,
  workOrderStatusTone,
} from "@/lib/status-tone";

function isWorkOrderStatus(status: string): status is WorkOrderStatus {
  return Object.hasOwn(workOrderStatusTone, status);
}

/**
 * A report or work-order status, labelled and toned (shared by both). Report
 * status is typed as a plain string, so an unknown value shows as-is, outlined.
 */
export function WorkOrderStatusBadge({ status }: { status: string }) {
  const known = isWorkOrderStatus(status);
  const label = known ? workOrderStatusLabel[status] : status;
  return (
    <Badge
      className="w-fit"
      variant={badgeVariantFor(known ? workOrderStatusTone[status] : undefined)}
    >
      {label}
    </Badge>
  );
}
