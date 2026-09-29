import { createFileRoute } from "@tanstack/react-router";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

export const Route = createFileRoute("/_auth/estates/$estateId/")({
  component: EstateDetailsRoute,
  head: () => ({ meta: [{ title: "Estate details" }] }),
});

function EstateDetailsRoute() {
  const { estateId } = Route.useParams();
  return (
    <EstateDetailsPage estateId={estateId}>
      <LocationsSection estateId={estateId} />
    </EstateDetailsPage>
  );
}
