import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { RecordRepairPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/maintenance/new/-components/record-repair-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/maintenance/new/"
)({
  component: RecordRepairRoute,
  head: () => pageHead("Record repair"),
});

function RecordRepairRoute() {
  const { estateId, assetId } = Route.useParams();
  return <RecordRepairPage assetId={assetId} estateId={estateId} />;
}
