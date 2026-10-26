import { createFileRoute } from "@tanstack/react-router";
import { WorkOrderForm } from "./-components/work-order-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/new/"
)({
  validateSearch: (
    search: Record<string, unknown>
  ): { sourceReportId?: string } => {
    if (search.sourceReportId === undefined) {
      return {};
    }
    if (
      typeof search.sourceReportId !== "string" ||
      !UUID.test(search.sourceReportId)
    ) {
      throw new Error("Invalid source report.");
    }
    return { sourceReportId: search.sourceReportId };
  },
  component: NewWorkOrderRoute,
  head: () => ({ meta: [{ title: "Create work order" }] }),
});
function NewWorkOrderRoute() {
  const { estateId } = Route.useParams();
  const { sourceReportId } = Route.useSearch();
  return (
    <WorkOrderForm
      estateId={estateId}
      key={`${estateId}:${sourceReportId}`}
      sourceReportId={sourceReportId}
    />
  );
}
