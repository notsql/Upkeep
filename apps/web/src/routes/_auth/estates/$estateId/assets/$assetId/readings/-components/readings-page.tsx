import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { ReadingCards } from "@/components/readings/reading-cards";
import type { ReadingFilters } from "@/lib/readings";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/reading-filters";
import { ReadingsHeader } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/readings-header";
import { ReadingsPagination } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/readings-pagination";
import { ReadingsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/readings-table";
import {
  emptyMessage,
  useReadingsPage,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/use-readings-page";

export function ReadingsPage({
  estateId,
  assetId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  assetId: string;
  filters: ReadingFilters;
  onFiltersChange: (filters: ReadingFilters) => void;
}) {
  const {
    asset,
    canRecord,
    clearFilters,
    filtered,
    mobile,
    next,
    page,
    pages,
    previous,
    readings,
    total,
  } = useReadingsPage(estateId, assetId, filters, onFiltersChange);
  return (
    <PageLayout className="space-y-6">
      <ReadingsHeader
        assetId={assetId}
        assetName={asset.data?.name}
        canRecord={canRecord}
        estateId={estateId}
        metric={filters.metric}
      />
      <ReadingFilterControls filters={filters} onChange={onFiltersChange} />
      {readings.isPending ? (
        <LoadingState label="Loading readings…" rows={2} />
      ) : null}
      {readings.error ? (
        <Alert variant="destructive">
          <AlertDescription>{readings.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {readings.data && total === 0 ? (
        <EmptyState
          action={
            filtered ? (
              <Button onClick={clearFilters} variant="outline">
                Clear filters
              </Button>
            ) : undefined
          }
          title={emptyMessage(filters)}
        />
      ) : null}
      {readings.data && total > 0 ? (
        <>
          {mobile ? (
            <ReadingCards
              items={readings.data.items}
              refreshing={readings.isFetching}
            />
          ) : (
            <ReadingsTable readings={readings.data.items} />
          )}
          <ReadingsPagination
            onNext={next}
            onPrevious={previous}
            page={page}
            pages={pages}
            total={total}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
