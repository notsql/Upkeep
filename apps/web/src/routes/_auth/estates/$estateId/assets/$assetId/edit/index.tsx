import { createFileRoute } from "@tanstack/react-router";
import { EditAssetPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-editor-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/edit/"
)({
  component: EditAssetRoute,
  head: () => ({ meta: [{ title: "Edit asset" }] }),
});

function EditAssetRoute() {
  const { estateId, assetId } = Route.useParams();
  return <EditAssetPage assetId={assetId} estateId={estateId} />;
}
