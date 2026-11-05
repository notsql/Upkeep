import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetMaintenance } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/maintenance/"
)({
  component: AssetMaintenanceRoute,
  head: () => pageHead("Asset maintenance"),
});

function AssetMaintenanceRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetMaintenance assetId={assetId} estateId={estateId} />;
}
