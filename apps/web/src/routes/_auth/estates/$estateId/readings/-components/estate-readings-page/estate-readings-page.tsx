import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Activity } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import type { ReadingSearch } from "@/lib/reading-filters";
import { ReadingExport } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-export";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";
import { ReadingResults } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-results";
import { ReadingToolbar } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-toolbar";
import { useEstateReadingsPage } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/use-estate-readings-page";

export function EstateReadingsPage({
  estateId,
  filters,
  onFiltersChange,
}: {
  estateId: string;
  filters: ReadingSearch;
  onFiltersChange: (filters: ReadingSearch) => void;
}) {
  const {
    activeCount,
    assets,
    chooseAsset,
    error,
    forbidden,
    label,
    panel,
    readings,
    retryAssets,
  } = useEstateReadingsPage(estateId, filters, onFiltersChange);
  if (forbidden) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Readings access is no longer available.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <PageLayout className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <ListPageHeader icon={Activity} title="Readings" />
      <div className="space-y-3">
        <ReadingToolbar
          activeCount={activeCount}
          exportAction={
            <ReadingExport
              disabled={
                !!error ||
                readings.isFetching ||
                readings.isPending ||
                readings.isError
              }
              estateId={estateId}
              filters={filters}
            />
          }
          {...panel.toggleProps}
        />
        <ReadingFilterControls
          assetLabel={label}
          error={error}
          estateId={estateId}
          filters={filters}
          onChoose={chooseAsset}
          onFiltersChange={onFiltersChange}
          {...panel.barProps}
        />
      </div>
      {assets.error ? (
        <ErrorState
          message={assets.error.message}
          onRetry={retryAssets}
          retryLabel="Retry assets"
        />
      ) : null}
      <ReadingResults
        assetsPending={assets.isPending}
        assetTotal={assets.data?.totalItems}
        filters={filters}
        onFiltersChange={onFiltersChange}
        readings={readings}
        validationError={error}
      />
    </PageLayout>
  );
}
