import { createFileRoute } from "@tanstack/react-router";
import { EstateDetailsPage } from "@/components/estates/estate-details-page";

export const Route = createFileRoute("/_authenticated/estates/$estateId/")({
  component: EstateDetailsRoute,
  head: () => ({ meta: [{ title: "Estate details" }] }),
});

function EstateDetailsRoute() {
  const { estateId } = Route.useParams();
  return <EstateDetailsPage estateId={estateId} />;
}
