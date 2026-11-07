import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetCostsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/asset-costs-section";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/costs/"
)({
  component: AssetCostsRoute,
  head: () => pageHead("Asset costs"),
});

function AssetCostsRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetCostsSection assetId={assetId} estateId={estateId} />;
}
