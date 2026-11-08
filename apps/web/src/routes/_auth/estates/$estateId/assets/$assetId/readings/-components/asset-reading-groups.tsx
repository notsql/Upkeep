import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { DeviceMetric } from "@/lib/devices";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { useAssetReadingGroupPages } from "@/lib/readings";
import { GroupedReadingsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/grouped-readings/grouped-readings-table";
import {
  emptyMessage,
  isFiltered,
} from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-results";

/** The asset readings page's grouped results, appended with "Load older". */
export function AssetReadingGroups({
  filters,
  onFiltersChange,
  readings,
  validationError,
}: {
  filters: ReadingSearch;
  onFiltersChange: (filters: ReadingSearch) => void;
  readings: ReturnType<typeof useAssetReadingGroupPages>;
  validationError?: string;
}) {
  const { fetchNextPage, refetch } = readings;
  const retry = useCallback(() => refetch(), [refetch]);
  const clear = useCallback(() => onFiltersChange({}), [onFiltersChange]);
  const older = useCallback(() => fetchNextPage(), [fetchNextPage]);
  if (validationError) {
    return (
      <Alert id="reading-filter-error" variant="destructive">
        <AlertDescription>{validationError}</AlertDescription>
      </Alert>
    );
  }
  if (readings.error && !readings.data) {
    return (
      <ErrorState
        message={readings.error.message}
        onRetry={retry}
        retryLabel="Retry readings"
      />
    );
  }
  if (!readings.data) {
    return <LoadingState label="Loading readings…" variant="table" />;
  }
  const groups = readings.data.pages.flatMap((page) => page.groups);
  if (groups.length === 0) {
    if (isFiltered(filters)) {
      return (
        <EmptyState
          action={
            <Button onClick={clear} variant="outline">
              Clear filters
            </Button>
          }
          title={emptyMessage(filters)}
        />
      );
    }
    return <EmptyState title={emptyMessage(filters)} />;
  }
  return (
    <div className="min-w-0 space-y-3">
      <GroupedReadingsTable
        groups={groups}
        label="Readings"
        metrics={filters.metric ? [filters.metric as DeviceMetric] : undefined}
        refreshing={readings.isFetching}
      />
      {readings.isFetchNextPageError ? (
        <Alert variant="destructive">
          <AlertDescription>{readings.error?.message}</AlertDescription>
        </Alert>
      ) : null}
      {readings.hasNextPage ? (
        <Button
          disabled={readings.isFetchingNextPage}
          onClick={older}
          type="button"
          variant="outline"
        >
          {readings.isFetchingNextPage ? "Loading…" : "Load older"}
        </Button>
      ) : null}
    </div>
  );
}
