import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { parseReadingSearch } from "@/lib/reading-filters";
import type { ManualReading } from "@/lib/readings";
import { ManualReadingForm } from "./-components/manual-reading-form";

export const Route = createFileRoute("/_auth/estates/$estateId/readings/new/")({
  validateSearch: parseReadingSearch,
  component: ManualReadingRoute,
  head: () => ({ meta: [{ title: "Record manual reading" }] }),
});
function ManualReadingRoute() {
  const { estateId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const saved = useCallback(
    (reading: ManualReading) => {
      navigate({
        to: "/estates/$estateId/readings",
        params: { estateId },
        search: { assetId: reading.assetId },
      });
    },
    [estateId, navigate]
  );
  return (
    <ManualReadingForm
      estateId={estateId}
      initialAssetId={search.assetId}
      initialMetric={search.metric}
      key={`${user.id}:${estateId}`}
      onSaved={saved}
    />
  );
}
