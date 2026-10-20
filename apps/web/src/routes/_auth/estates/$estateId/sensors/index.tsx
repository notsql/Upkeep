import { createFileRoute } from "@tanstack/react-router";
import { SensorsPage } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page";

export const Route = createFileRoute("/_auth/estates/$estateId/sensors/")({
  component: SensorsRoute,
  head: () => ({ meta: [{ title: "Device monitoring" }] }),
});

function SensorsRoute() {
  const { estateId } = Route.useParams();
  return <SensorsPage estateId={estateId} />;
}
