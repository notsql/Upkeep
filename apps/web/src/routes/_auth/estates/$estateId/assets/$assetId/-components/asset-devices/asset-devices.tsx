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
  // Adding sensors needs MANAGE_DEVICES (estate-role-permissions).
  const canManageDevices = Boolean(
    access.data?.estates.find((item) => item.estateId === estateId)
      ?.canManageDevices
  );
  if (!asset.data) {
    return null;
  }
  return (
    <AssetDevicesSection
      assetId={assetId}
      canRegister={canManageDevices && !asset.data.deactivatedAt}
      estateId={estateId}
    />
  );
}
