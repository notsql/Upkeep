import { createFileRoute } from "@tanstack/react-router";
import { InspectionDetail } from "./-components/inspection-detail";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/"
)({
  component: InspectionDetailRoute,
  head: () => ({ meta: [{ title: "Inspection record" }] }),
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
