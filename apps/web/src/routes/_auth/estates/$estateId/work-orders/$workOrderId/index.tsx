import type { components } from "@proj/api/schema";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { WorkOrderContractorEmail } from "./-components/work-order-contractor-email";
import { WorkOrderDetailPage } from "./-components/work-order-detail-page";
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/$workOrderId/"
)({
  component: WorkOrderDetailRoute,
  head: () => ({ meta: [{ title: "Work order details" }] }),
});
function WorkOrderDetailRoute() {
  const { estateId, workOrderId } = Route.useParams();
  // ID-70: equipment faults from a resident report can be emailed to a contractor.
  const sections = useCallback(
    (order: components["schemas"]["WorkOrderResponse"], canCreate: boolean) =>
      order.category === "EQUIPMENT_FAULT" &&
      order.source === "RESIDENT_REPORT" ? (
        <WorkOrderContractorEmail
          canCreate={canCreate}
          estateId={estateId}
          order={order}
        />
      ) : null,
    [estateId]
  );
  return (
    <WorkOrderDetailPage
      estateId={estateId}
      sections={sections}
      workOrderId={workOrderId}
    />
  );
}
