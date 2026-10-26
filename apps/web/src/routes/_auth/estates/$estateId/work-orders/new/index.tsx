import { createFileRoute } from "@tanstack/react-router";
import { WorkOrderForm } from "./-components/work-order-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/new/"
)({
  validateSearch: (
    search: Record<string, unknown>
  ): { sourceReportId?: string; sourceInspectionId?: string } => {
    const { sourceReportId, sourceInspectionId } = search;
    if (sourceReportId !== undefined && sourceInspectionId !== undefined) {
      throw new Error("Choose one source only.");
    }
    if (
      sourceReportId !== undefined &&
      (typeof sourceReportId !== "string" || !UUID.test(sourceReportId))
    ) {
      throw new Error("Invalid source report.");
    }
    if (
      sourceInspectionId !== undefined &&
      (typeof sourceInspectionId !== "string" || !UUID.test(sourceInspectionId))
    ) {
      throw new Error("Invalid source inspection.");
    }
    return {
      ...(typeof sourceReportId === "string" ? { sourceReportId } : {}),
      ...(typeof sourceInspectionId === "string" ? { sourceInspectionId } : {}),
    };
  },
  component: NewWorkOrderRoute,
  head: () => ({ meta: [{ title: "Create work order" }] }),
});
function NewWorkOrderRoute() {
  const { estateId } = Route.useParams();
  const { sourceReportId, sourceInspectionId } = Route.useSearch();
  return (
    <WorkOrderForm
      estateId={estateId}
      key={`${estateId}:${sourceReportId}:${sourceInspectionId}`}
      sourceInspectionId={sourceInspectionId}
      sourceReportId={sourceReportId}
    />
  );
}
