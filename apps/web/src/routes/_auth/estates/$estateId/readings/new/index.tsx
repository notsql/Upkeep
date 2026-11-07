import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback } from "react";
import { pageHead } from "@/lib/page-title";
import {
  manualReadingLocation,
  parseReadingSearch,
  readingsLocation,
} from "@/lib/reading-filters";
import type { ManualReading } from "@/lib/readings";
import { ManualReadingForm } from "@/routes/_auth/estates/$estateId/readings/new/-components/manual-reading-form/manual-reading-form";

export const Route = createFileRoute("/_auth/estates/$estateId/readings/new/")({
  validateSearch: parseReadingSearch,
  // A preselected asset lives in the path (`/readings/$assetId/new`).
  beforeLoad: ({ params, search }) => {
    if (search.assetId) {
      throw redirect({
        ...manualReadingLocation(params.estateId, {
          assetId: search.assetId,
          metric: search.metric,
        }),
        replace: true,
      });
    }
  },
  component: ManualReadingRoute,
  head: () => pageHead("Record manual reading"),
});
function ManualReadingRoute() {
  const { estateId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
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
      initialMetric={search.metric}
      key={`${user.id}:${estateId}`}
      onSaved={saved}
    />
  );
}
