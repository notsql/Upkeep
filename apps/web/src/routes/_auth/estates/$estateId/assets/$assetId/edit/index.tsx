import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EditAssetPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-editor-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/edit/"
)({
  component: EditAssetRoute,
  head: () => pageHead("Edit asset"),
});

function EditAssetRoute() {
  const { estateId, assetId } = Route.useParams();
  return <EditAssetPage assetId={assetId} estateId={estateId} />;
}
