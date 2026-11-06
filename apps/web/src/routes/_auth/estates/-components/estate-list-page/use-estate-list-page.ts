import { type ChangeEvent, useCallback } from "react";
import { useFilterPanel } from "@/components/filters/filter-bar";
import { type EstateStatus, useEstateList } from "@/lib/estates";
import type {
  EstateAccess,
  EstateDirectoryFilters,
} from "@/routes/_auth/estates/-components/estate-directory-filters";

function emptyMessageFor(
  status: EstateStatus,
  hasSearchOrAccess: boolean
): string {
  if (hasSearchOrAccess) {
    return "Try another search or access filter";
  }
  if (status === "ALL") {
    return "No estates yet";
  }
  return `No ${status.toLowerCase()} estates`;
}

export function useEstateListPage(
  filters: EstateDirectoryFilters,
  onFiltersChange: (filters: EstateDirectoryFilters) => void
) {
  const status = filters.status ?? "ACTIVE";
  const access = filters.access ?? "ALL";
  const search = (filters.q ?? "").trim().toLowerCase();
  const estates = useEstateList(status);
  const visible = estates.data?.filter(
    (estate) =>
      (access === "ALL" ||
        (access === "OWNED" ? estate.owned : !estate.owned)) &&
      [estate.name, estate.code, estate.address].some((value) =>
        value.toLowerCase().includes(search)
      )
  );
  const hasSearchOrAccess = Boolean(search) || access !== "ALL";
  const retry = useCallback(() => estates.refetch(), [estates.refetch]);
  const changeSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onFiltersChange({ ...filters, q: event.target.value || undefined }),
    [onFiltersChange, filters]
  );
  const changeStatus = useCallback(
    (value: EstateStatus | null) => {
      if (value) {
        onFiltersChange({ ...filters, status: value });
      }
    },
    [onFiltersChange, filters]
  );
  const changeAccess = useCallback(
    (value: EstateAccess | null) => {
      if (value) {
        onFiltersChange({ ...filters, access: value });
      }
    },
    [onFiltersChange, filters]
  );
  const clearFilters = useCallback(
    () => onFiltersChange({}),
    [onFiltersChange]
  );
  const emptyMessage = emptyMessageFor(status, hasSearchOrAccess);
  const activeCount =
    (search ? 1 : 0) +
    (access === "ALL" ? 0 : 1) +
    (status === "ACTIVE" ? 0 : 1);
  const filtersActive = activeCount > 0;
  const count = visible?.length ?? 0;
  const panel = useFilterPanel(activeCount);

  return {
    access,
    activeCount,
    changeAccess,
    changeSearch,
    changeStatus,
    clearFilters,
    count,
    emptyMessage,
    estates,
    filtersActive,
    panel,
    retry,
    status,
    visible,
  };
}
