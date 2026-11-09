import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetRecords } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-records/asset-records";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/records/"
)({
  component: AssetRecordsRoute,
  head: () => pageHead("Asset records"),
});

function AssetRecordsRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetRecords assetId={assetId} estateId={estateId} />;
}
