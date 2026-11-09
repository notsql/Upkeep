import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { WorkOrderForm } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-form/work-order-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export const Route = createFileRoute(
  "/_auth/estates/$estateId/work-orders/new/"
)({
  validateSearch: (
    search: Record<string, unknown>
  ): {
    sourceReportId?: string;
    sourceInspectionId?: string;
    assetId?: string;
    reason?: "END_OF_LIFE";
  } => {
    const { sourceReportId, sourceInspectionId, assetId, reason } = search;
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
    const prefill =
      typeof assetId === "string" &&
      UUID.test(assetId) &&
      reason === "END_OF_LIFE" &&
      sourceReportId === undefined &&
      sourceInspectionId === undefined;
    return {
      ...(typeof sourceReportId === "string" ? { sourceReportId } : {}),
      ...(typeof sourceInspectionId === "string" ? { sourceInspectionId } : {}),
      ...(prefill ? { assetId, reason } : {}),
    };
  },
  component: NewWorkOrderRoute,
  head: () => pageHead("Create work order"),
});
function NewWorkOrderRoute() {
  const { estateId } = Route.useParams();
  const { sourceReportId, sourceInspectionId, assetId, reason } =
    Route.useSearch();
  return (
    <WorkOrderForm
      assetId={assetId}
      estateId={estateId}
      key={`${estateId}:${sourceReportId}:${sourceInspectionId}:${assetId}`}
      reason={reason}
      sourceInspectionId={sourceInspectionId}
      sourceReportId={sourceReportId}
    />
  );
}
