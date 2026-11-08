import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { pageHead } from "@/lib/page-title";
import {
  mergeReadingSearch,
  parseReadingSearch,
  type ReadingSearch,
  readingsLocation,
} from "@/lib/reading-filters";
import { EstateReadingsPage } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/estate-readings-page";

/** The estate readings browser with the asset fixed by the path. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/readings/$assetId/"
)({
  validateSearch: parseReadingSearch,
  component: AssetReadingsRoute,
  head: () => pageHead("Readings"),
});

function AssetReadingsRoute() {
  const { estateId, assetId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const filters = useMemo(() => ({ ...search, assetId }), [search, assetId]);
  const navigate = Route.useNavigate();
  const change = useCallback(
    (next: ReadingSearch) => {
      navigate({
        ...readingsLocation(
          estateId,
          mergeReadingSearch(filters, filters, next)
        ),
        resetScroll: false,
      });
    },
    [estateId, filters, navigate]
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
