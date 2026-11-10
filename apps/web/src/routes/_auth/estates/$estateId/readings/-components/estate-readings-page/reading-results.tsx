import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Activity } from "lucide-react";
import { useCallback } from "react";
import { PossiblyWrongNote } from "@/components/readings/possibly-wrong-note";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import type { PagedList } from "@/lib/infinite-list";
import type { ReadingSearch } from "@/lib/reading-filters";
import { ReadingPagination } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-pagination";
import { ReadingTable } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-table";

export function isFiltered(filters: ReadingSearch): boolean {
  return !!(
    filters.assetId ||
    filters.metric ||
    filters.from ||
    filters.to ||
    filters.suspect ||
    filters.anomalous
  );
}

export function emptyMessage(
  filters: ReadingSearch,
  assetTotal?: number
): string {
  if (filters.anomalous) {
    return "No unusual readings match these filters";
  }
  if (filters.suspect) {
    return "No possibly wrong readings match these filters";
  }
  if (isFiltered(filters)) {
    return "No matching readings";
  }
  return assetTotal === 0 ? "No assets yet" : "No readings yet";
}

export function ReadingResults({
  readings,
  validationError,
  assetsPending,
  assetTotal,
  filters,
  onFiltersChange,
}: {
  readings: PagedList<components["schemas"]["EstateReadingPage"]>;
  validationError?: string;
  assetsPending: boolean;
  assetTotal?: number;
  filters: ReadingSearch;
  onFiltersChange: (filters: ReadingSearch) => void;
}) {
  const retry = useCallback(() => readings.refetch(), [readings.refetch]);
  const clear = useCallback(() => onFiltersChange({}), [onFiltersChange]);
  const first = useCallback(
    () => onFiltersChange({ ...filters, page: undefined }),
    [filters, onFiltersChange]
  );
  if (validationError) {
    return (
      <Alert id="reading-filter-error" variant="destructive">
        <AlertDescription>{validationError}</AlertDescription>
      </Alert>
    );
  }
  if (readings.error) {
    return (
      <ErrorState
        message={readings.error.message}
        onRetry={retry}
        retryLabel="Retry readings"
      />
    );
  }
  if (!readings.data) {
    return readings.isPending ? (
      <LoadingState label="Loading readings…" variant="table" />
    ) : null;
  }
  const { data } = readings;
  if (data.totalItems === 0) {
    if (assetsPending) {
      return <LoadingState label="Loading assets…" variant="table" />;
    }
    if (isFiltered(filters)) {
      return (
        <EmptyState
          action={
            <Button onClick={clear} variant="outline">
              Clear filters
            </Button>
          }
          icon={Activity}
          title={emptyMessage(filters, assetTotal)}
        />
      );
    }
    return (
      <EmptyState icon={Activity} title={emptyMessage(filters, assetTotal)} />
    );
  }
  if (data.items.length === 0) {
    return (
      <EmptyState
        action={
          <Button onClick={first} variant="outline">
            Go to first page
          </Button>
        }
        icon={Activity}
        title="No readings on this page"
      />
    );
  }
  return (
    <>
      {readings.isFetching ? <p role="status">Refreshing readings…</p> : null}
      <PossiblyWrongNote readings={data.items} />
      <ReadingTable items={data.items} refreshing={readings.isFetching} />
      {readings.more ? (
        <LoadMore {...readings.more} />
      ) : (
        <ReadingPagination
          filters={filters}
          onChange={onFiltersChange}
          placeholder={readings.isPlaceholderData}
          size={data.size}
          total={data.totalItems}
        />
      )}
    </>
  );
}
