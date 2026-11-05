import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { SearchX } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { useEstateReadings } from "@/lib/readings";
import { ReadingPagination } from "./reading-pagination";
import { ReadingTable } from "./reading-table";

function isFiltered(filters: ReadingSearch): boolean {
  return !!(
    filters.assetId ||
    filters.metric ||
    filters.from ||
    filters.to ||
    filters.suspect
  );
}

function emptyMessage(filters: ReadingSearch, assetTotal?: number): string {
  if (filters.suspect) {
    return "No matching suspect readings";
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
  createAction,
}: {
  readings: ReturnType<typeof useEstateReadings>;
  validationError?: string;
  assetsPending: boolean;
  assetTotal?: number;
  filters: ReadingSearch;
  onFiltersChange: (filters: ReadingSearch) => void;
  /** Shown in the empty card when the estate has no readings yet. */
  createAction?: ReactNode;
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
          icon={SearchX}
          title={emptyMessage(filters, assetTotal)}
        />
      );
    }
    return (
      <EmptyState
        action={assetTotal === 0 ? undefined : createAction}
        title={emptyMessage(filters, assetTotal)}
      />
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
        title="No readings on this page"
      />
    );
  }
  return (
    <>
      {readings.isFetching ? <p role="status">Refreshing readings…</p> : null}
      <ReadingTable items={data.items} refreshing={readings.isFetching} />
      <ReadingPagination
        filters={filters}
        onChange={onFiltersChange}
        placeholder={readings.isPlaceholderData}
        size={data.size}
        total={data.totalItems}
      />
    </>
  );
}
