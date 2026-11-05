import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { InspectionResult } from "@/lib/inspections";

export function InspectionFollowUp({
  record,
  estateId,
  canCreate,
  active,
  pending,
}: {
  record: InspectionResult;
  estateId: string;
  canCreate: boolean;
  active: boolean;
  pending: boolean;
}) {
  if (record.outcome === "PASS") {
    return <p>Closed</p>;
  }
  if (record.workOrder) {
    return (
      <Link
        className="underline"
        params={{ estateId, workOrderId: record.workOrder.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {record.workOrder.reference}
      </Link>
    );
  }
  return (
    <>
      <p>Awaiting work order</p>
      {canCreate && active ? (
        <Link
          className={buttonVariants()}
          params={{ estateId }}
          search={{ sourceInspectionId: record.id }}
          to="/estates/$estateId/work-orders/new"
        >
          Create work order
        </Link>
      ) : (
        <p>
          {pending
            ? "Loading work-order eligibility…"
            : "Work-order creation is unavailable while the estate, asset or location is inactive, or your creation permission is unavailable."}
        </p>
      )}
    </>
  );
}
