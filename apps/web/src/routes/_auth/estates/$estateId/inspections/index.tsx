import { createFileRoute } from "@tanstack/react-router";
import { InspectionsPage } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page";

export const Route = createFileRoute("/_auth/estates/$estateId/inspections/")({
  component: InspectionsRoute,
  head: () => ({ meta: [{ title: "Inspections" }] }),
});

function InspectionsRoute() {
  const { estateId } = Route.useParams();
  return <InspectionsPage estateId={estateId} />;
}
