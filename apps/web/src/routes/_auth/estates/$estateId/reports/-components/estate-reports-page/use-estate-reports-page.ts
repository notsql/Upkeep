import { useCallback } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import {
  type EstateReportFilters,
  useEstateReportAccess,
  useEstateReportFeed,
  useEstateReportList,
  useEstateReportLocations,
} from "@/lib/estate-reports";
import { asPagedList } from "@/lib/infinite-list";
import type { RoutingState } from "@/lib/report-routing";
import { useMobile } from "@/lib/use-mobile";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";
import { countReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters/report-filters";

export function useEstateReportsPage(
  estateId: string,
  {
    blockId,
    minLevelPosition,
    maxLevelPosition,
    routingState,
    cursor,
    openOnly = true,
    sort = "URGENCY",
  }: EstateReportsSearch,
  onSearch: (search: EstateReportsSearch) => void
) {
  const filters = {
    blockId,
    minLevelPosition,
    maxLevelPosition,
    openOnly,
    sort,
  };
  const activeCount = countReportFilters(filters) + (routingState ? 1 : 0);
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const access = useEstateReportAccess(estateId);
  const listFilters = { ...filters, routingState };
  const mobile = useMobile();
  const page = useEstateReportList(estateId, listFilters, cursor, !mobile);
  const feed = asPagedList(useEstateReportFeed(estateId, listFilters, mobile));
  const reports = mobile ? feed : page;
  const locations = useEstateReportLocations(estateId);
  const filter = useCallback(
    (values: EstateReportFilters) => onSearch({ ...values, routingState }),
    [onSearch, routingState]
  );
  const filterRouting = useCallback(
    (value: RoutingState | undefined) =>
      onSearch({
        blockId,
        minLevelPosition,
        maxLevelPosition,
        routingState: value,
        openOnly,
        sort,
      }),
    [blockId, minLevelPosition, maxLevelPosition, openOnly, sort, onSearch]
  );
  const clearFilters = useCallback(() => onSearch({}), [onSearch]);
  const retry = useCallback(() => reports.refetch(), [reports.refetch]);
  const retryLocations = useCallback(
    () => locations.refetch(),
    [locations.refetch]
  );
  const next = useCallback(() => {
    onSearch({
      blockId,
      minLevelPosition,
      maxLevelPosition,
      routingState,
      cursor: reports.data?.nextCursor ?? undefined,
      openOnly,
      sort,
    });
  }, [
    blockId,
    minLevelPosition,
    maxLevelPosition,
    routingState,
    onSearch,
    openOnly,
    sort,
    reports.data?.nextCursor,
  ]);
  const first = useCallback(
    () =>
      onSearch({
        blockId,
        minLevelPosition,
        maxLevelPosition,
        routingState,
        openOnly,
        sort,
      }),
    [
      blockId,
      minLevelPosition,
      maxLevelPosition,
      routingState,
      openOnly,
      sort,
      onSearch,
    ]
  );

  return {
    access,
    activeCount,
    clearFilters,
    filter,
    filterRouting,
    filtered,
    filters,
    first,
    locations,
    next,
    panel,
    reports,
    retry,
    retryLocations,
    routingState,
  };
}
