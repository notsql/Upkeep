import { createFileRoute } from "@tanstack/react-router";
import { NewDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/new/-components/new-device-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/devices/new/"
)({
  component: NewDeviceRoute,
  head: () => ({ meta: [{ title: "Register device" }] }),
});
function NewDeviceRoute() {
  const { estateId, assetId } = Route.useParams();
  return <NewDevicePage assetId={assetId} estateId={estateId} />;
}
