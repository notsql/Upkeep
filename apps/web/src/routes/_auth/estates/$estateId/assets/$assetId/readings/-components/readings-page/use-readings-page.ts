import { useCallback } from "react";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import {
  READINGS_PAGE_SIZE,
  type ReadingFilters,
  useReadings,
} from "@/lib/readings";
import { useMobile } from "@/lib/use-mobile";

export function emptyMessage(filters: ReadingFilters): string {
  if (filters.suspect) {
    return "No suspect readings match";
  }
  if (filters.metric || filters.from || filters.to) {
    return "No readings match these filters";
  }
  return "No readings yet";
}

export function useReadingsPage(
  estateId: string,
  assetId: string,
  filters: ReadingFilters,
  onFiltersChange: (filters: ReadingFilters) => void
) {
  const mobile = useMobile();
  const asset = useAsset(estateId, assetId);
  const canRecord = useAppAccess().data?.estates.find(
    (entry) => entry.estateId === estateId
  )?.canRecordReadings;
  const readings = useReadings(estateId, assetId, filters);
  const page = filters.page ?? 0;
  const total = readings.data?.totalItems ?? 0;
  const pages = Math.max(1, Math.ceil(total / READINGS_PAGE_SIZE));
  const previous = useCallback(
    () => onFiltersChange({ ...filters, page: page - 1 }),
    [filters, onFiltersChange, page]
  );
  const next = useCallback(
    () => onFiltersChange({ ...filters, page: page + 1 }),
    [filters, onFiltersChange, page]
  );
  const filtered = Boolean(
    filters.suspect || filters.metric || filters.from || filters.to
  );
  const clearFilters = useCallback(
    () => onFiltersChange({}),
    [onFiltersChange]
  );
  return {
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
  };
}
