import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import {
  type AssetSort,
  type AssetSortColumn,
  sortAssets,
} from "@/lib/asset-sorting";
import { type AssetFilters, useAssets } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { flattenLocations, useLocations } from "@/lib/locations";
import { useMobile } from "@/lib/use-mobile";

export function useAssetRegisterPage(
  estateId: string,
  filters: AssetFilters,
  onFiltersChange: (filters: AssetFilters) => void,
  sort: AssetSort,
  onSortChange?: (sort: AssetSort) => void
) {
  const mobile = useMobile();
  const assets = useAssets(estateId, filters);
  const categories = useAssetCategories();
  const sortedAssets = useMemo(
    () => sortAssets(assets.data ?? [], sort, categories.data),
    [assets.data, sort, categories.data]
  );
  const sortColumn = sort.sortBy ?? "REFERENCE";
  const descending = sort.direction === "DESC";
  const changeSort = useCallback(
    (column: AssetSortColumn) => {
      let direction: NonNullable<AssetSort["direction"]> =
        column === "CONDITION" ? "DESC" : "ASC";
      if (column === sortColumn) {
        direction = descending ? "ASC" : "DESC";
      }
      onSortChange?.({ sortBy: column, direction });
    },
    [onSortChange, sortColumn, descending]
  );
  const estate = useEstate(estateId);
  const locations = useLocations(estateId, true);
  const [search, setSearch] = useState(filters.q ?? "");
  useEffect(() => setSearch(filters.q ?? ""), [filters.q]);
  useEffect(() => {
    if (search.trim() === (filters.q ?? "")) {
      return;
    }
    const timer = setTimeout(
      () => onFiltersChange({ ...filters, q: search.trim() || undefined }),
      300
    );
    return () => clearTimeout(timer);
  }, [search, filters, onFiltersChange]);
  const activeCount = [
    filters.q,
    filters.category,
    filters.locationId,
    filters.condition,
    filters.status && filters.status !== "ACTIVE",
  ].filter(Boolean).length;
  const filtered = activeCount > 0;
  const panel = useFilterPanel(activeCount);
  const canRegister = !estate.data?.deactivatedAt;
  const locationOptions = useMemo(
    () =>
      Object.fromEntries(
        flattenLocations(locations.data ?? []).map((location) => [
          location.id,
          `${location.path.join(" › ")}${location.deactivatedAt ? " (inactive)" : ""}`,
        ])
      ),
    [locations.data]
  );
  const retryAssets = useCallback(() => assets.refetch(), [assets.refetch]);
  const retryLocations = useCallback(
    () => locations.refetch(),
    [locations.refetch]
  );
  const clearFilters = useCallback(() => {
    setSearch("");
    onFiltersChange({});
  }, [onFiltersChange]);
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSearch(event.target.value),
    []
  );
  return {
    activeCount,
    assets,
    canRegister,
    categories: categories.data,
    changeSearch,
    changeSort,
    clearFilters,
    descending,
    estate,
    filtered,
    locations,
    locationOptions,
    mobile,
    panel,
    retryAssets,
    retryLocations,
    search,
    sortColumn,
    sortedAssets,
  };
}
