import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { pageHead } from "@/lib/page-title";
import {
  mergeReadingSearch,
  parseReadingSearch,
  type ReadingSearch,
} from "@/lib/reading-filters";
import { AssetReadingsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-readings-page";

/** The asset is the path segment, so it never appears in the search. */
function validateSearch(search: Record<string, unknown>): ReadingSearch {
  const { assetId: _asset, ...rest } = parseReadingSearch(search);
  return rest;
}

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/readings/"
)({
  validateSearch,
  component: ReadingsRoute,
  head: () => pageHead("Readings"),
});

function ReadingsRoute() {
  const { estateId, assetId } = Route.useParams();
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
    <AssetReadingsPage
      assetId={assetId}
      estateId={estateId}
      filters={filters}
      onFiltersChange={change}
    />
  );
}
