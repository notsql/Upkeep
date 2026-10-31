import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { useEstateReadings } from "@/lib/readings";
import { ReadingPagination } from "./reading-pagination";
import { ReadingTable } from "./reading-table";

function emptyMessage(filters: ReadingSearch, assetTotal?: number): string {
  if (filters.suspect) {
    return "No suspect readings match";
  }
  if (filters.assetId || filters.metric || filters.from || filters.to) {
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
    return readings.isPending ? <p role="status">Loading readings…</p> : null;
  }
  const { data } = readings;
  if (data.totalItems === 0) {
    return assetsPending ? (
      <p role="status">Loading assets…</p>
    ) : (
      <div className="section-surface" role="status">
        {emptyMessage(filters, assetTotal)}
      </div>
    );
  }
  if (data.items.length === 0) {
    return (
      <div className="section-surface space-y-3" role="status">
        <p>This page is beyond the available readings.</p>
        <Button onClick={first} variant="outline">
          Go to first page
        </Button>
      </div>
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
