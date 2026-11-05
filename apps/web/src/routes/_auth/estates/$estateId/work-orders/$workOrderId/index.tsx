import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { WorkOrderDetailPage } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-detail-page";
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/$workOrderId/"
)({
  component: WorkOrderDetailRoute,
  head: () => pageHead("Work order details"),
});
function WorkOrderDetailRoute() {
  const { estateId, workOrderId } = Route.useParams();
  return <WorkOrderDetailPage estateId={estateId} workOrderId={workOrderId} />;
}
