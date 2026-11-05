import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { SensorsView } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

export const Route = createFileRoute("/_auth/estates/$estateId/sensors/all/")({
  component: SensorsAllRoute,
  head: () => pageHead("All device metrics"),
});

function SensorsAllRoute() {
  const { estateId } = Route.useParams();
  return <SensorsView estateId={estateId} view="ALL" />;
}
