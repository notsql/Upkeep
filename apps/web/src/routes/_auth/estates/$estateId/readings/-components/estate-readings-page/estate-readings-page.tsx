import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Activity, Upload } from "lucide-react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { useAppAccess } from "@/lib/access";
import type { ReadingSearch } from "@/lib/reading-filters";
import { ReadingExport } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-export";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";
import { ReadingResults } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-results";
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
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const inactive =
    permission?.canViewReadings &&
    !permission.canRecordReadings &&
    !permission.canImportReadings;
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
        actions={
          permission?.canImportReadings ? (
            <Button
              render={
                <Link
                  params={{ estateId }}
                  to="/estates/$estateId/readings/imports"
                />
              }
              variant="outline"
            >
              <Upload aria-hidden="true" />
              Import CSV
            </Button>
          ) : undefined
        }
        create={create}
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Activity}
        title="Readings"
      />
      {inactive ? (
        <Alert>
          <AlertDescription>
            This estate is inactive. Import and rollback are unavailable.
          </AlertDescription>
        </Alert>
      ) : null}
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
