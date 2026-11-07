import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { InspectionsPage } from "@/routes/_auth/estates/$estateId/inspections/-components/inspections-page/inspections-page";

export const Route = createFileRoute("/_auth/estates/$estateId/inspections/")({
  component: InspectionsRoute,
  head: () => pageHead("Inspections"),
});

function InspectionsRoute() {
  const { estateId } = Route.useParams();
  return <InspectionsPage estateId={estateId} />;
}
