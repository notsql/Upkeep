import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { type AssetFilters, assetCategoryLabel } from "@/lib/assets";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateSearch(search: Record<string, unknown>): AssetFilters {
  return {
    q: typeof search.q === "string" ? search.q.trim() || undefined : undefined,
    category:
      typeof search.category === "string" &&
      Object.hasOwn(assetCategoryLabel, search.category)
        ? (search.category as AssetFilters["category"])
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
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const change = useCallback(
    (search: AssetFilters) => {
      navigate({ search });
    },
    [navigate]
  );
  return (
    <AssetRegisterPage
      estateId={estateId}
      filters={filters}
      onFiltersChange={change}
    />
  );
}
