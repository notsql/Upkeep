import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { InspectionHistoryRowProps } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-row-props";

export function InspectionFollowUp({
  record,
  canCreateWorkOrder,
  canViewWorkOrder,
}: InspectionHistoryRowProps) {
  if (record.outcome === "PASS") {
    return <>Closed</>;
  }
  if (record.workOrder) {
    if (!canViewWorkOrder) {
      return <>{record.workOrder.reference}</>;
    }
    return (
      <Link
        className="underline underline-offset-4"
        params={{ estateId: record.estateId, workOrderId: record.workOrder.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {record.workOrder.reference}
      </Link>
    );
  }
  return canCreateWorkOrder ? (
    <Link
      className={buttonVariants({ size: "sm" })}
      params={{ estateId: record.estateId }}
      search={{ sourceInspectionId: record.id }}
      to="/estates/$estateId/work-orders/new"
    >
      Create work order
    </Link>
  ) : null;
}
