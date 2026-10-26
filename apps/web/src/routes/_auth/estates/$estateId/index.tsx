import { createFileRoute } from "@tanstack/react-router";
import { useAppAccess } from "@/lib/access";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

export const Route = createFileRoute("/_auth/estates/$estateId/")({
  component: EstateDetailsRoute,
  head: () => ({ meta: [{ title: "Estate details" }] }),
});

function EstateDetailsRoute() {
  const { estateId } = Route.useParams();
  const access = useAppAccess();
  const management = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  )?.canViewManagement;
  return (
    <EstateDetailsPage estateId={estateId}>
      {management ? <LocationsSection estateId={estateId} /> : null}
    </EstateDetailsPage>
  );
}
