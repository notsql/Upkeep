import { useCallback } from "react";
import { useFilterPanel } from "@/components/filter-bar";
import {
  type EstateReportFilters,
  useEstateReportAccess,
  useEstateReportList,
  useEstateReportLocations,
} from "@/lib/estate-reports";
import type { EstateReportsSearch } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-search";
import { countReportFilters } from "@/routes/_auth/estates/$estateId/reports/-components/report-filters";

export function useEstateReportsPage(
  estateId: string,
  { blockId, minLevelPosition, maxLevelPosition, cursor }: EstateReportsSearch,
  onSearch: (search: EstateReportsSearch) => void
) {
  const filters = { blockId, minLevelPosition, maxLevelPosition };
  const activeCount = countReportFilters(filters);
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const access = useEstateReportAccess(estateId);
  const reports = useEstateReportList(estateId, filters, cursor);
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
    });
  }, [
    blockId,
    minLevelPosition,
    maxLevelPosition,
    onSearch,
    reports.data?.nextCursor,
  ]);
  const first = useCallback(
    () => onSearch({ blockId, minLevelPosition, maxLevelPosition }),
    [blockId, minLevelPosition, maxLevelPosition, onSearch]
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
