import type { components } from "@proj/api/schema";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { pageHead } from "@/lib/page-title";
import { WorkOrderAssignment } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-assignment";
import { WorkOrderDetailPage } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-detail-page";
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/$workOrderId/"
)({
  component: WorkOrderDetailRoute,
  head: () => pageHead("Work order details"),
});
function WorkOrderDetailRoute() {
  const { estateId, workOrderId } = Route.useParams();
  const sections = useCallback(
    (order: components["schemas"]["WorkOrderResponse"], canCreate: boolean) => (
      <WorkOrderAssignment
        canAssign={canCreate}
        estateId={estateId}
        order={order}
      />
    ),
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
