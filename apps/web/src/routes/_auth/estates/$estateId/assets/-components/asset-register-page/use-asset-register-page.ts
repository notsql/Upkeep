import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import { useAppAccess } from "@/lib/access";
import {
  type AssetBlockGroup,
  deviceSummaries,
  groupAssetsByLocation,
} from "@/lib/asset-monitoring";
import {
  type AssetSort,
  type AssetSortColumn,
  sortAssets,
} from "@/lib/asset-sorting";
import { type AssetFilters, useAssets } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstateDevices } from "@/lib/devices";
import { useEstate } from "@/lib/estates";
import { flagReasonLabel, useEstateFailureRisk } from "@/lib/failure-risk";
import { flattenLocations, useLocations } from "@/lib/locations";
import { useMobile } from "@/lib/use-mobile";
import type {
  MonitoringColumns,
  MonitoringSource,
} from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page/asset-monitoring-cells";

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
  // Each source mounts only for viewers its endpoint serves, so none 403s.
  const access = useAppAccess();
  const owned = Boolean(estate.data?.owned);
  const role = access.data?.estates?.find(
    (item) => item.estateId === estateId
  )?.role;
  const showDevices = owned || role === "MANAGER";
  const devices = useEstateDevices(estateId, showDevices);
  const risk = useEstateFailureRisk(estateId, owned);
  // Groups depend only on asset and location data, never on devices or risk,
  // so rows keep their order while those load.
  const groups = useMemo((): AssetBlockGroup[] | null => {
    if (!locations.data) {
      return null;
    }
    const grouped = groupAssetsByLocation(sortedAssets, locations.data);
    return grouped.some((group) => group.levels[0]?.name !== null)
      ? grouped
      : null;
  }, [sortedAssets, locations.data]);
  const monitoring = useMemo((): MonitoringColumns => {
    const columns: MonitoringColumns = {};
    if (showDevices) {
      const summary = deviceSummaries(devices.data ?? []);
      columns.devices = {
        pending: devices.isPending,
        failed: devices.isError,
        valueFor: summary,
      } satisfies MonitoringSource;
    }
    if (owned) {
      const flags = new Map(
        (risk.data ?? [])
          .filter((entry) => entry.flagReasons.length > 0)
          .map((entry) => [
            entry.assetId,
            `Flagged: ${entry.flagReasons.map((reason) => flagReasonLabel[reason]).join(", ")}`,
          ])
      );
      columns.risk = {
        pending: risk.isPending,
        failed: risk.isError,
        valueFor: (assetId) => flags.get(assetId) ?? null,
      };
    }
    return columns;
  }, [
    showDevices,
    owned,
    devices.data,
    devices.isPending,
    devices.isError,
    risk.data,
    risk.isPending,
    risk.isError,
  ]);
  const failedSources = [
    ...(monitoring.devices?.failed ? ["devices" as const] : []),
    ...(monitoring.risk?.failed ? ["risk" as const] : []),
  ];
  const retryMonitoring = useCallback(() => {
    if (devices.isError) {
      devices.refetch();
    }
    if (risk.isError) {
      risk.refetch();
    }
  }, [devices.isError, devices.refetch, risk.isError, risk.refetch]);
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
    failedSources,
    filtered,
    groups,
    locations,
    locationOptions,
    mobile,
    monitoring,
    panel,
    retryAssets,
    retryLocations,
    retryMonitoring,
    search,
    sortColumn,
    sortedAssets,
  };
}
