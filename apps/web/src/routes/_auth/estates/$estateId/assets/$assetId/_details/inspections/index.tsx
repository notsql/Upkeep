import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { InspectionHistoryTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-table";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/inspections/"
)({
  component: AssetInspectionsRoute,
  head: () => pageHead("Asset inspections"),
});

function AssetInspectionsRoute() {
  const { estateId, assetId } = Route.useParams();
  return <InspectionHistoryTable assetId={assetId} estateId={estateId} />;
}
