import { createFileRoute } from "@tanstack/react-router";
import { EditAssetPage } from "@/components/assets/asset-editor-page";

export const Route = createFileRoute(
  "/_authenticated/estates/$estateId/assets/$assetId/edit"
)({
  component: EditAssetRoute,
  head: () => ({ meta: [{ title: "Edit asset" }] }),
});

function EditAssetRoute() {
  const { estateId, assetId } = Route.useParams();
  return <EditAssetPage assetId={assetId} estateId={estateId} />;
}
