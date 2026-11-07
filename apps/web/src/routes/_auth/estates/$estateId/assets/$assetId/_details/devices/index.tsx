import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { AssetDevices } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/assets/$assetId/_details/devices/"
)({
  component: AssetDevicesRoute,
  head: () => pageHead("Asset devices"),
});

function AssetDevicesRoute() {
  const { estateId, assetId } = Route.useParams();
  return <AssetDevices assetId={assetId} estateId={estateId} />;
}
