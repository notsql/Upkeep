import { createFileRoute } from "@tanstack/react-router";
import { EstateDevicesPage } from "@/routes/_auth/estates/$estateId/devices/-components/estate-devices-page";

export const Route = createFileRoute("/_auth/estates/$estateId/devices/")({
  component: DevicesRoute,
  head: () => ({ meta: [{ title: "Devices" }] }),
});

function DevicesRoute() {
  const { estateId } = Route.useParams();
  return <EstateDevicesPage estateId={estateId} />;
}
