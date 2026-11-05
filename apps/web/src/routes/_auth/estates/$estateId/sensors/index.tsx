import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { SensorsPage } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

export const Route = createFileRoute("/_auth/estates/$estateId/sensors/")({
  component: SensorsRoute,
  head: () => pageHead("Device monitoring"),
});

function SensorsRoute() {
  const { estateId } = Route.useParams();
  return <SensorsPage estateId={estateId} />;
}
