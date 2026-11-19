import { Separator } from "@proj/ui/components/separator";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { AssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-section";
import { AssetServiceIntervalCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-service-interval-card";

/** Why the service-interval override is read-only, if it is. */
function intervalLock(
  estateInactive: boolean,
  assetRetired: boolean
): string | undefined {
  if (estateInactive) {
    return "This estate is inactive, so its service intervals cannot be changed.";
  }
  if (assetRetired) {
    return "This asset is out of use, so you can't change how often it's serviced.";
  }
}

export function AssetMaintenance({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  if (!asset.data) {
    return null;
  }
  return (
    <>
      <AssetMaintenanceSection
        assetId={assetId}
        canRecord={
          Boolean(permission?.canEditAssets) && !asset.data.deactivatedAt
        }
        estateId={estateId}
      />
      {permission?.canManageInspections ? (
        <>
          <Separator />
          <AssetServiceIntervalCard
            assetId={assetId}
            estateId={estateId}
            locked={intervalLock(
              Boolean(estate.data?.deactivatedAt),
              Boolean(asset.data.deactivatedAt)
            )}
          />
        </>
      ) : null}
    </>
  );
}
