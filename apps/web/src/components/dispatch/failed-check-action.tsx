import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useInspectionSource } from "@/lib/inspections";

/**
 * "Send a contractor" for a failed inspection: the work order form, filled in
 * from the result. Once a work order exists for it, names that instead.
 */
export function FailedCheckAction({
  estateId,
  inspectionResultId,
}: {
  estateId: string;
  inspectionResultId: string;
}) {
  const source = useInspectionSource(estateId, inspectionResultId);
  if (source.isPending) {
    return null;
  }
  const order = source.data?.workOrder;
  if (order) {
    return (
      <Link
        className="text-sm underline"
        params={{ estateId, workOrderId: order.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {`Contractor already sent · ${order.reference}`}
      </Link>
    );
  }
  return (
    <Link
      className={buttonVariants({ size: "sm" })}
      params={{ estateId }}
      search={{ sourceInspectionId: inspectionResultId }}
      to="/estates/$estateId/work-orders/new"
    >
      Send a contractor
    </Link>
  );
}
