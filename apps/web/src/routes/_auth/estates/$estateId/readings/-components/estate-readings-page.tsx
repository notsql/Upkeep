import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Activity } from "lucide-react";
import { useCallback, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { useFilterPanel } from "@/components/filter-bar";
import {
  CreateButton,
  type CreateButtonProps,
} from "@/components/page-actions";
import { ListPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useAppAccess } from "@/lib/access";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";
import {
  type EstateReading,
  type ReadingAsset,
  useEstateReadings,
  useReadingAssets,
} from "@/lib/readings";
import { ReadingExport } from "./reading-export";
import {
  countReadingFilters,
  ReadingFilterControls,
} from "./reading-filter-controls";
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
  const activeCount = countReadingFilters(filters);
  const panel = useFilterPanel(activeCount);
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
  const create: CreateButtonProps | undefined = estate?.canRecordReadings
    ? {
        params: { estateId },
        search: { assetId: filters.assetId, metric: filters.metric },
        to: "/estates/$estateId/readings/new",
      }
    : undefined;
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
        createAction={create ? <CreateButton {...create} /> : undefined}
        filters={filters}
        onFiltersChange={onFiltersChange}
        readings={readings}
        validationError={error}
      />
    </PageLayout>
  );
}
