import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { LoadingState } from "@/components/loading-state";
import { useInspectionAccess } from "@/lib/inspections";
import { pageHead } from "@/lib/page-title";
import {
  ASSET_TABS,
  AssetDetailsPage,
  type AssetTab,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";
import { InspectionAssetPage } from "./-components/inspection-asset-page";

function validateSearch(search: Record<string, unknown>): { tab?: AssetTab } {
  const tab = ASSET_TABS.find((option) => option.value === search.tab)?.value;
  return tab && tab !== "overview" ? { tab } : {};
}

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/"
)({
  validateSearch,
  component: AssetDetailsRoute,
  head: () => pageHead("Asset details"),
});

function AssetDetailsRoute() {
  const { estateId, assetId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const changeTab = useCallback(
    (next: AssetTab) =>
      navigate({
        search: next === "overview" ? {} : { tab: next },
        replace: true,
        resetScroll: false,
      }),
    [navigate]
  );
  const access = useInspectionAccess(estateId);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canViewAssets) {
    return <InspectionAssetPage assetId={assetId} estateId={estateId} />;
  }
  return (
    <AssetDetailsPage
      assetId={assetId}
      estateId={estateId}
      onTabChange={changeTab}
      tab={tab}
    />
  );
}
