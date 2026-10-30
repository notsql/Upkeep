import { createFileRoute } from "@tanstack/react-router";
import { AssetCategoriesPage } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories/"
)({
  component: AssetCategoriesRoute,
  head: () => ({ meta: [{ title: "Asset categories" }] }),
});

function AssetCategoriesRoute() {
  const { estateId } = Route.useParams();
  return <AssetCategoriesPage estateId={estateId} />;
}
