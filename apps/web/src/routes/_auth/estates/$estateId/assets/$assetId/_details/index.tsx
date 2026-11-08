import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import {
  type AssetSection,
  LEGACY_TABS,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-page";
import { AssetOverview } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-overview";

/** Old `?tab=` links (before each section had its own page) still land. */
function validateSearch(search: Record<string, unknown>): {
  tab?: AssetSection;
} {
  const tab =
    typeof search.tab === "string" && Object.hasOwn(LEGACY_TABS, search.tab)
      ? LEGACY_TABS[search.tab]
      : undefined;
  return tab ? { tab } : {};
}

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/"
)({
  validateSearch,
  beforeLoad: ({ search, params }) => {
    if (search.tab) {
      throw redirect({
        params,
        replace: true,
        to: `/estates/$estateId/assets/$assetId/${search.tab}`,
      });
    }
  },
  component: AssetOverviewRoute,
  head: () => pageHead("Asset details"),
});

function AssetOverviewRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetOverview assetId={assetId} estateId={estateId} />;
}
