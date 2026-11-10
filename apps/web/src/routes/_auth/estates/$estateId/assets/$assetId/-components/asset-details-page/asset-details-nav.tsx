import { Badge } from "@proj/ui/components/badge";
import { SubNav } from "@/components/page/sub-nav";
import { activeDevices, useAssetViewsAccess, useDevices } from "@/lib/devices";

export function AssetDetailsNav({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const params = { estateId, assetId };
  const access = useAssetViewsAccess(estateId);
  // Only owners and Managers may list devices, so no one else requests them.
  const devices = useDevices(estateId, assetId, access.devices);
  const count = devices.data ? activeDevices(devices.data).length : 0;
  return (
    <SubNav
      items={[
        {
          exact: true,
          label: "Overview",
          params,
          to: "/estates/$estateId/assets/$assetId",
        },
        {
          label: "History",
          params,
          to: "/estates/$estateId/assets/$assetId/history",
        },
        {
          label: "Details",
          params,
          to: "/estates/$estateId/assets/$assetId/details",
        },
        {
          label: "Records",
          params,
          to: "/estates/$estateId/assets/$assetId/records",
        },
        {
          label: "Costs",
          params,
          to: "/estates/$estateId/assets/$assetId/costs",
        },
        {
          badge:
            access.devices && count ? (
              <Badge className="tabular-nums" variant="secondary">
                {count}
              </Badge>
            ) : undefined,
          label: "Sensors",
          params,
          to: "/estates/$estateId/assets/$assetId/devices",
        },
      ]}
      label="Asset sections"
    />
  );
}
