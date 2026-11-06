import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { ReplaceDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/$deviceId/replace/-components/replace-device-page/replace-device-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/devices/$deviceId/replace/"
)({
  component: ReplaceDeviceRoute,
  head: () => pageHead("Replace device"),
});
function ReplaceDeviceRoute() {
  const { estateId, assetId, deviceId } = Route.useParams();
  return (
    <ReplaceDevicePage
      assetId={assetId}
      deviceId={deviceId}
      estateId={estateId}
    />
  );
}
