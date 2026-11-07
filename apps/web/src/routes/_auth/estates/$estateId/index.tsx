import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/estate-details-page";

export const Route = createFileRoute("/_auth/estates/$estateId/")({
  component: EstateDetailsRoute,
  head: () => pageHead("Estate overview"),
});

function EstateDetailsRoute() {
  const { estateId } = Route.useParams();
  return <EstateDetailsPage estateId={estateId} />;
}
