import { createFileRoute } from "@tanstack/react-router";
import { WorkOrderDetailPage } from "./-components/work-order-detail-page";
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/$workOrderId/"
)({
  component: WorkOrderDetailRoute,
  head: () => ({ meta: [{ title: "Work order details" }] }),
});
function WorkOrderDetailRoute() {
  const { estateId, workOrderId } = Route.useParams();
  return <WorkOrderDetailPage estateId={estateId} workOrderId={workOrderId} />;
}
