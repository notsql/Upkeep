import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { InspectionDetail } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail/inspection-detail";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/"
)({
  component: InspectionDetailRoute,
  head: () => pageHead("Inspection record"),
});
function InspectionDetailRoute() {
  const { estateId, assetId, inspectionId } = Route.useParams();
  return (
    <InspectionDetail
      assetId={assetId}
      estateId={estateId}
      inspectionId={inspectionId}
    />
  );
}
