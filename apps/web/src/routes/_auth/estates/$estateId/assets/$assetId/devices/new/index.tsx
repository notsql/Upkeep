import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NewDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/new/-components/new-device-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/devices/new/"
)({
  component: NewDeviceRoute,
  head: () => pageHead("Add sensor"),
});
function NewDeviceRoute() {
  const { estateId, assetId } = Route.useParams();
  return <NewDevicePage assetId={assetId} estateId={estateId} />;
}
