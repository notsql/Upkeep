import { useCallback, useState } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import type { CreateButtonProps } from "@/components/page/page-actions";
import { useAppAccess } from "@/lib/access";
import { type ReadingSearch, readingFilterError } from "@/lib/reading-filters";
import {
  type EstateReading,
  type ReadingAsset,
  useEstateReadings,
  useReadingAssets,
} from "@/lib/readings";
import { countReadingFilters } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";

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
export function useEstateReadingsPage(
  estateId: string,
  filters: ReadingSearch,
  onFiltersChange: (filters: ReadingSearch) => void
) {
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
  const create: CreateButtonProps | undefined = estate?.canRecordReadings
    ? {
        params: { estateId },
        search: { assetId: filters.assetId, metric: filters.metric },
        to: "/estates/$estateId/readings/new",
      }
    : undefined;
  return {
    activeCount,
    assets,
    chooseAsset,
    create,
    error,
    forbidden: !!access.data && !estate?.canViewReadings,
    label,
    panel,
    readings,
    retryAssets,
  };
}
