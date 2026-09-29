import { createFileRoute } from "@tanstack/react-router";
import { AssetDetailsPage } from "@/routes/_authenticated/estates/$estateId/assets/$assetId/-components/asset-details-page";

export const Route = createFileRoute(
  "/_authenticated/estates/$estateId/assets/$assetId/"
)({
  component: AssetDetailsRoute,
  head: () => ({ meta: [{ title: "Asset details" }] }),
});

function AssetDetailsRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetDetailsPage assetId={assetId} estateId={estateId} />;
}
