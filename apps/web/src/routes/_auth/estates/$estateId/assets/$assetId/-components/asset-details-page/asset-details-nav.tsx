import { Badge } from "@proj/ui/components/badge";
import { SubNav, type SubNavItem } from "@/components/page/sub-nav";
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
  const items: SubNavItem[] = [
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
  ];
  // Only tabs the viewer can open (estate-role-permissions).
  if (access.costs) {
    items.push({
      label: "Costs",
      params,
      to: "/estates/$estateId/assets/$assetId/costs",
    });
  }
  if (access.devices) {
    items.push({
      badge: count ? (
        <Badge className="tabular-nums" variant="secondary">
          {count}
        </Badge>
      ) : undefined,
      label: "Sensors",
      params,
      to: "/estates/$estateId/assets/$assetId/devices",
    });
  }
  return <SubNav items={items} label="Asset sections" />;
}
