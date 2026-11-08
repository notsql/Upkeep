import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetDetailsTab } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-details-tab";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/details/"
)({
  component: AssetDetailsTabRoute,
  head: () => pageHead("Asset details"),
});

function AssetDetailsTabRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetDetailsTab assetId={assetId} estateId={estateId} />;
}
