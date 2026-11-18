import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices-section";

export function AssetDevices({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  // Adding sensors needs MANAGE_DEVICES; readings need VIEW_READINGS
  // (estate-role-permissions).
  const canManageDevices = Boolean(permission?.canManageDevices);
  if (!asset.data) {
    return null;
  }
  return (
    <AssetDevicesSection
      assetId={assetId}
      canRegister={canManageDevices && !asset.data.deactivatedAt}
      canViewReadings={Boolean(permission?.canViewReadings)}
      estateId={estateId}
    />
  );
}
