import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import {
  AssetCategoriesList,
  intervalFilterFor,
} from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/asset-categories-page";

/** One service-interval view: days, months, years or not-set. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/asset-categories/$interval/"
)({
  beforeLoad: ({ params }) => {
    const filter = intervalFilterFor(params.interval);
    if (!filter) {
      throw notFound();
    }
    return { filter };
  },
  component: AssetCategoriesIntervalRoute,
  head: () => pageHead("Asset categories"),
});

function AssetCategoriesIntervalRoute() {
  const { estateId } = Route.useParams();
  const { filter } = Route.useRouteContext();
  return <AssetCategoriesList estateId={estateId} filter={filter} />;
}
