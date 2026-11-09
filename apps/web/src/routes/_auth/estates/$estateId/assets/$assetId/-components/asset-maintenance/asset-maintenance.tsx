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
    return "This asset is retired, so its service interval cannot be changed.";
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
  if (!asset.data) {
    return null;
  }
  return (
    <>
      <AssetMaintenanceSection
        assetId={assetId}
        canRecord={!asset.data.deactivatedAt}
        estateId={estateId}
      />
      {estate.data?.owned || estate.data?.canManageInvitationPermissions ? (
        <AssetServiceIntervalCard
          assetId={assetId}
          estateId={estateId}
          locked={intervalLock(
            Boolean(estate.data.deactivatedAt),
            Boolean(asset.data.deactivatedAt)
          )}
        />
      ) : null}
    </>
  );
}
