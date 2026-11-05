import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetDocumentsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-section";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/documents/"
)({
  component: AssetDocumentsRoute,
  head: () => pageHead("Asset documents"),
});

function AssetDocumentsRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetDocumentsSection assetId={assetId} estateId={estateId} />;
}
