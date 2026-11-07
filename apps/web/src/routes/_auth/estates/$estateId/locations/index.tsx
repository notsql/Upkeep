import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { LocationsPage } from "@/routes/_auth/estates/$estateId/locations/-components/locations-page";

export const Route = createFileRoute("/_auth/estates/$estateId/locations/")({
  component: LocationsRoute,
  head: () => pageHead("Locations"),
});

function LocationsRoute() {
  const { estateId } = Route.useParams();
  return <LocationsPage estateId={estateId} />;
}
