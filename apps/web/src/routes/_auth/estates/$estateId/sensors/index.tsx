import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { SensorsView } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

export const Route = createFileRoute("/_auth/estates/$estateId/sensors/")({
  component: SensorsReviewRoute,
  head: () => pageHead("Device monitoring"),
});

function SensorsReviewRoute() {
  const { estateId } = Route.useParams();
  return <SensorsView estateId={estateId} view="REVIEW" />;
}
