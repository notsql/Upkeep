import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { pageHead } from "@/lib/page-title";
import { parseReadingSearch, readingsLocation } from "@/lib/reading-filters";
import type { ManualReading } from "@/lib/readings";
import { ManualReadingForm } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/manual-reading-form";

/** Manual entry preselected to the asset in the path. */
export const Route = createFileRoute(
  "/_auth/estates/$estateId/readings/$assetId/new/"
)({
  validateSearch: (search: Record<string, unknown>): { metric?: string } => ({
    metric: parseReadingSearch(search).metric,
  }),
  component: AssetManualReadingRoute,
  head: () => pageHead("Record manual reading"),
});

function AssetManualReadingRoute() {
  const { estateId, assetId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const { metric } = Route.useSearch();
  const navigate = Route.useNavigate();
  const saved = useCallback(
    (reading: ManualReading) => {
      navigate(readingsLocation(estateId, { assetId: reading.assetId }));
    },
    [estateId, navigate]
  );
  return (
    <ManualReadingForm
      estateId={estateId}
      initialAssetId={assetId}
      initialMetric={metric}
      key={`${user.id}:${estateId}:${assetId}`}
      onSaved={saved}
    />
  );
}
