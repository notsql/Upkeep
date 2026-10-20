import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { deviceMetrics } from "@/lib/devices";
import type { ReadingFilters } from "@/lib/readings";
import { ReadingsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/readings-page";

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function localDateTime(value: unknown): string | undefined {
  return typeof value === "string" && LOCAL_DATE_TIME.test(value)
    ? value
    : undefined;
}

function validateSearch(search: Record<string, unknown>): ReadingFilters {
  const page = Number(search.page);
  return {
    metric:
      typeof search.metric === "string" && search.metric in deviceMetrics
        ? (search.metric as ReadingFilters["metric"])
        : undefined,
    from: localDateTime(search.from),
    to: localDateTime(search.to),
    suspect:
      search.suspect === true || search.suspect === "true" ? true : undefined,
    page: Number.isInteger(page) && page > 0 ? page : undefined,
  };
}

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/readings/"
)({
  validateSearch,
  component: ReadingsRoute,
  head: () => ({ meta: [{ title: "Readings" }] }),
});

function ReadingsRoute() {
  const { estateId, assetId } = Route.useParams();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const change = useCallback(
    (search: ReadingFilters) => {
      navigate({ search });
    },
    [navigate]
  );
  return (
    <ReadingsPage
      assetId={assetId}
      estateId={estateId}
      filters={filters}
      onFiltersChange={change}
    />
  );
}
