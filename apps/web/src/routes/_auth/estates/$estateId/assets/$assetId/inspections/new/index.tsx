import { createFileRoute } from "@tanstack/react-router";
import { InspectionForm } from "./-components/inspection-form";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/inspections/new/"
)({
  component: NewInspectionRoute,
  head: () => ({ meta: [{ title: "Create inspection record" }] }),
});
function NewInspectionRoute() {
  const { estateId, assetId } = Route.useParams();
  return (
    <InspectionForm
      assetId={assetId}
      estateId={estateId}
      key={`${estateId}:${assetId}`}
    />
  );
}
