import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { useAppAccess } from "@/lib/access";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";
import {
  type EstateReading,
  type ReadingAsset,
  useEstateReadings,
  useReadingAssets,
} from "@/lib/readings";
import { ReadingExport } from "./reading-export";
import { ReadingFilterControls } from "./reading-filter-controls";
import { ReadingResults } from "./reading-results";

function selectedLabel(
  id: string | undefined,
  selected: ReadingAsset | undefined,
  reading: EstateReading | undefined
): string {
  if (!id) {
    return "All assets";
  }
  if (selected) {
    return `${selected.reference} · ${selected.name}`;
  }
  if (reading) {
    return `${reading.assetReference} · ${reading.assetName}`;
  }
  return "Selected asset";
}

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
  const estate = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  const readings = useEstateReadings(estateId, filters);
  const assets = useReadingAssets(estateId);
  const [chosen, setChosen] = useState<ReadingAsset>();
  const chooseAsset = useCallback(
    (asset: ReadingAsset | undefined) => {
      setChosen(asset);
      onFiltersChange({ ...filters, assetId: asset?.id, page: undefined });
    },
    [filters, onFiltersChange]
  );
  const retryAssets = useCallback(() => assets.refetch(), [assets.refetch]);
  const error = readingFilterError(filters);
  const selected =
    chosen?.id === filters.assetId
      ? chosen
      : assets.data?.items.find((item) => item.id === filters.assetId);
  const label = selectedLabel(
    filters.assetId,
    selected,
    readings.data?.items.find((item) => item.assetId === filters.assetId)
  );
  if (access.data && !estate?.canViewReadings) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Readings access is no longer available.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <main className="page-layout min-w-0 space-y-6 [overflow-wrap:anywhere]">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: estate?.estateName ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          { label: "Readings" },
        ]}
        description={estate?.estateName}
        title="Readings"
      />
      {estate?.canRecordReadings ? (
        <Button
          render={
            <Link
              params={{ estateId }}
              search={{ assetId: filters.assetId, metric: filters.metric }}
              to="/estates/$estateId/readings/new"
            />
          }
        >
          Record manual reading
        </Button>
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
      />
      {assets.error ? (
        <Alert variant="destructive">
          <AlertDescription>
            {assets.error.message}
            <Button onClick={retryAssets} variant="outline">
              Retry assets
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <ReadingResults
        assetsPending={assets.isPending}
        assetTotal={assets.data?.totalItems}
        filters={filters}
        onFiltersChange={onFiltersChange}
        readings={readings}
        validationError={error}
      />
    </main>
  );
}
