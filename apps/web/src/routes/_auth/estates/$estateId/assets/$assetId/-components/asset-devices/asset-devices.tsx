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
  if (!asset.data) {
    return null;
  }
  return (
    <AssetDevicesSection
      assetId={assetId}
      canRegister={!asset.data.deactivatedAt}
      estateId={estateId}
    />
  );
}
