import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { type AssetSort, assetSortOptions } from "@/lib/asset-sorting";
import type { AssetFilters } from "@/lib/assets";
import { useInspectionAccess } from "@/lib/inspections";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page";
import { InspectionAssetList } from "./-components/inspection-asset-list";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateSearch(
  search: Record<string, unknown>
): AssetFilters & AssetSort {
  if (
    search.sortBy !== undefined &&
    !assetSortOptions.some((option) => option.value === search.sortBy)
  ) {
    throw new Error("Choose a valid asset sort column.");
  }
  if (
    search.direction !== undefined &&
    search.direction !== "ASC" &&
    search.direction !== "DESC"
  ) {
    throw new Error("Choose a valid sort direction.");
  }
  return {
    ...(search.sortBy ? { sortBy: search.sortBy as AssetSort["sortBy"] } : {}),
    ...(search.direction
      ? { direction: search.direction as AssetSort["direction"] }
      : {}),
    q: typeof search.q === "string" ? search.q.trim() || undefined : undefined,
    // The server rejects an unknown category, so any code passes through here.
    category:
      typeof search.category === "string"
        ? search.category.trim() || undefined
        : undefined,
    locationId:
      typeof search.locationId === "string" &&
      UUID_PATTERN.test(search.locationId)
        ? search.locationId
        : undefined,
    condition:
      typeof search.condition === "string" &&
      ["GOOD", "NEEDS_ATTENTION", "FAULTY", "UNASSESSED"].includes(
        search.condition
      )
        ? (search.condition as AssetFilters["condition"])
        : undefined,
    status:
      typeof search.status === "string" &&
      ["ACTIVE", "INACTIVE", "ALL"].includes(search.status)
        ? (search.status as AssetFilters["status"])
        : undefined,
  };
}
export const Route = createFileRoute("/_auth/estates/$estateId/assets/")({
  validateSearch,
  component: AssetRegisterRoute,
  head: () => ({ meta: [{ title: "Assets" }] }),
});
function AssetRegisterRoute() {
  const { estateId } = Route.useParams();
  const search = Route.useSearch();
  const { sortBy, direction } = search;
  const filters = useMemo(
    () => ({
      q: search.q,
      category: search.category,
      locationId: search.locationId,
      condition: search.condition,
      status: search.status,
    }),
    [search]
  );
  const navigate = Route.useNavigate();
  const change = useCallback(
    (values: AssetFilters) => {
      navigate({
        search: {
          ...values,
          ...(sortBy ? { sortBy } : {}),
          ...(direction ? { direction } : {}),
        },
      });
    },
    [navigate, sortBy, direction]
  );
  const changeSort = useCallback(
    (sort: AssetSort) =>
      navigate({ search: { ...filters, ...sort }, resetScroll: false }),
    [filters, navigate]
  );
  const access = useInspectionAccess(estateId);
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canViewAssets) {
    return <InspectionAssetList estateId={estateId} />;
  }
  return (
    <AssetRegisterPage
      estateId={estateId}
      filters={filters}
      onFiltersChange={change}
      onSortChange={changeSort}
      sort={{ sortBy, direction }}
    />
  );
}
