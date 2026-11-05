import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Activity } from "lucide-react";
import { useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
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
    return "No suspect readings match";
  }
  if (isFiltered(filters)) {
    return "No readings match these filters";
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
  readings: ReturnType<typeof useEstateReadings>;
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
      <Alert variant="destructive">
        <AlertDescription>
          {readings.error.message}
          <Button onClick={retry} variant="outline">
            Retry readings
          </Button>
        </AlertDescription>
      </Alert>
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
    return (
      <EmptyState
        action={
          isFiltered(filters) ? (
            <Button onClick={clear} variant="outline">
              Clear filters
            </Button>
          ) : undefined
        }
        icon={Activity}
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
        title="This page is beyond the available readings."
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
