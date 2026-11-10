import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AllDevicesPage } from "@/routes/_auth/estates/$estateId/assets/devices/-components/all-devices-page/all-devices-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/devices/"
)({
  component: AllDevicesRoute,
  head: () => pageHead("All sensors"),
});

function AllDevicesRoute() {
  const { estateId } = Route.useParams();
  return <AllDevicesPage estateId={estateId} />;
}
