import { createFileRoute } from "@tanstack/react-router";
import { useInspectionAccess } from "@/lib/inspections";
import { AssetDetailsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";
import { InspectionAssetPage } from "./-components/inspection-asset-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/"
)({
  component: AssetDetailsRoute,
  head: () => ({ meta: [{ title: "Asset details" }] }),
});

function AssetDetailsRoute() {
  const { estateId, assetId } = Route.useParams();
  const access = useInspectionAccess(estateId);
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canViewAssets) {
    return <InspectionAssetPage assetId={assetId} estateId={estateId} />;
  }
  return <AssetDetailsPage assetId={assetId} estateId={estateId} />;
}
