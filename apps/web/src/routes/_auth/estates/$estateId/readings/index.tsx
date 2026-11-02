import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  mergeReadingSearch,
  parseReadingSearch,
  type ReadingSearch,
} from "@/lib/reading-filters";
import { EstateReadingsPage } from "./-components/estate-readings-page";

export const Route = createFileRoute("/_auth/estates/$estateId/readings/")({
  validateSearch: parseReadingSearch,
  component: ReadingsRoute,
  head: () => ({ meta: [{ title: "Readings" }] }),
});

function ReadingsRoute() {
  const { estateId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const change = useCallback(
    (search: ReadingSearch) => {
      navigate({
        search: (latest) => mergeReadingSearch(latest, filters, search),
        resetScroll: false,
      });
    },
    [filters, navigate]
  );
  return (
    <EstateReadingsPage
      estateId={estateId}
      filters={filters}
      key={`${user.id}:${estateId}`}
      onFiltersChange={change}
    />
  );
}
