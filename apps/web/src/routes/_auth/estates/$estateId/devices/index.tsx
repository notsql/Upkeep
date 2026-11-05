import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { EstateDevicesPage } from "@/routes/_auth/estates/$estateId/devices/-components/estate-devices-page/estate-devices-page";

export const Route = createFileRoute("/_auth/estates/$estateId/devices/")({
  component: DevicesRoute,
  head: () => pageHead("Devices"),
});

function DevicesRoute() {
  const { estateId } = Route.useParams();
  return <EstateDevicesPage estateId={estateId} />;
}
