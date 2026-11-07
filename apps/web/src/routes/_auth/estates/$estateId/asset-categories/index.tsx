import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetCategoriesList } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/asset-categories-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories/"
)({
  component: AssetCategoriesRoute,
  head: () => pageHead("Asset categories"),
});

function AssetCategoriesRoute() {
  const { estateId } = Route.useParams();
  return <AssetCategoriesList estateId={estateId} filter="ALL" />;
}
