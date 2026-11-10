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
import { useMobile } from "@/lib/use-mobile";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";
import { countReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters/report-filters";

export function useEstateReportsPage(
  estateId: string,
  {
    blockId,
    minLevelPosition,
    maxLevelPosition,
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
  const activeCount = countReportFilters(filters);
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const access = useEstateReportAccess(estateId);
  const mobile = useMobile();
  const page = useEstateReportList(estateId, filters, cursor, !mobile);
  const feed = asPagedList(useEstateReportFeed(estateId, filters, mobile));
  const reports = mobile ? feed : page;
  const locations = useEstateReportLocations(estateId);
  const filter = useCallback(
    (values: EstateReportFilters) => onSearch(values),
    [onSearch]
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
      cursor: reports.data?.nextCursor ?? undefined,
      openOnly,
      sort,
    });
  }, [
    blockId,
    minLevelPosition,
    maxLevelPosition,
    onSearch,
    openOnly,
    sort,
    reports.data?.nextCursor,
  ]);
  const first = useCallback(
    () =>
      onSearch({ blockId, minLevelPosition, maxLevelPosition, openOnly, sort }),
    [blockId, minLevelPosition, maxLevelPosition, openOnly, sort, onSearch]
  );

  return {
    access,
    activeCount,
    clearFilters,
    filter,
    filtered,
    filters,
    first,
    locations,
    next,
    panel,
    reports,
    retry,
    retryLocations,
  };
}
