import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  assetHistoryQueryKey,
  type HistoryDateFilters,
  useAssetHistoryAccess,
  validateHistoryDates,
} from "@/lib/asset-history";
import { pageHead } from "@/lib/page-title";
import { AssetHistoryPage } from "./-components/asset-history-page";
import { HistoryAssetFrame } from "./-components/history-asset-frame";
import { HistoryDateFilter } from "./-components/history-date-filter";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/history/"
)({
  component: HistoryRoute,
  head: () => pageHead("Asset history"),
  validateSearch: validateHistoryDates,
});
function HistoryRoute() {
  const { estateId, assetId } = Route.useParams();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useAssetHistoryAccess(estateId);
  const client = useQueryClient();
  const changeDates = useCallback(
    async (dates: HistoryDateFilters) => {
      if (dates.from !== filters.from || dates.to !== filters.to) {
        await client.resetQueries({
          queryKey: assetHistoryQueryKey(
            access.userId,
            estateId,
            assetId,
            dates
          ),
          exact: true,
        });
      }
      await navigate({ search: dates, resetScroll: false });
    },
    [
      client,
      access.userId,
      estateId,
      assetId,
      filters.from,
      filters.to,
      navigate,
    ]
  );
  const content = (
    <div className="space-y-5">
      <HistoryDateFilter
        filters={filters}
        key={`${filters.from ?? ""}:${filters.to ?? ""}`}
        onApply={changeDates}
      />
      <AssetHistoryPage
        assetId={assetId}
        estateId={estateId}
        filters={filters}
      />
    </div>
  );
  if (access.permission?.canViewAssets) {
    return content;
  }
  return (
    <HistoryAssetFrame assetId={assetId} estateId={estateId} filters={filters}>
      {content}
    </HistoryAssetFrame>
  );
}
