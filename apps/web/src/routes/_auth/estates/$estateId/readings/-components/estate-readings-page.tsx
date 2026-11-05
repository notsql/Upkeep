import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Activity } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { ListPageHeader } from "@/components/list-page-header";
import { PageLayout } from "@/components/page-layout";
import type { ReadingSearch } from "@/lib/reading-filters";
import { ReadingExport } from "./reading-export";
import { ReadingFilterControls } from "./reading-filter-controls";
import { ReadingResults } from "./reading-results";
import { useEstateReadingsPage } from "./use-estate-readings-page";

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
    create,
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
      <ListPageHeader
        create={create}
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Activity}
        title="Readings"
      />
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
      <ReadingFilterControls
        assetLabel={label}
        error={error}
        estateId={estateId}
        filters={filters}
        onChoose={chooseAsset}
        onFiltersChange={onFiltersChange}
        {...panel.barProps}
      />
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
