import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  type EstateDirectoryFilters,
  validateEstateDirectorySearch,
} from "@/routes/_auth/estates/-components/estate-directory-filters";
import { EstateListPage } from "@/routes/_auth/estates/-components/estate-list-page";

export const Route = createFileRoute("/_auth/estates/")({
  validateSearch: validateEstateDirectorySearch,
  component: EstateDirectoryRoute,
  head: () => ({ meta: [{ title: "Estates" }] }),
});

function EstateDirectoryRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const change = useCallback(
    (search: EstateDirectoryFilters) => {
      navigate({ search, replace: true });
    },
    [navigate]
  );
  return <EstateListPage filters={filters} onFiltersChange={change} />;
}
