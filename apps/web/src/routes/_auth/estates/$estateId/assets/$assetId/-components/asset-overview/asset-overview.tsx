import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { canOpenInspections } from "@/lib/estate-destinations";
import { useEstate } from "@/lib/estates";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card";
import { AssetSummary } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-summary";
import { AssetUpcoming } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-upcoming/asset-upcoming";
import { DevicesOnlineStat } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/devices-online-stat";
import { TrendsCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-card";

export function AssetOverview({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const estate = useEstate(estateId);
  const access = useAppAccess();
  if (!asset.data) {
    return null;
  }
  // Each section mounts only for viewers its endpoint serves, so none 403s.
  const owned = Boolean(estate.data?.owned);
  const permission = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  const assetActive = !asset.data.deactivatedAt;
  const canSeeDevices = owned || permission?.role === "MANAGER";
  const showForecast = owned && asset.data.category === "PUMP";
  // The inspection list and service interval serve owners and delegates.
  const canSeeInspections = canOpenInspections(permission, owned);
  const canSeeService =
    owned || Boolean(estate.data?.canManageInvitationPermissions);
  const showUpcoming = canSeeInspections || canSeeService;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <AssetSummary asset={asset.data} />
        {canSeeDevices ? (
          <DevicesOnlineStat assetId={assetId} estateId={estateId} />
        ) : null}
      </div>
      <div
        className={
          showForecast || showUpcoming
            ? "grid items-stretch gap-6 lg:grid-cols-2"
            : "grid"
        }
      >
        <AssetConditionSection
          assetId={assetId}
          canRecord={assetActive}
          estateId={estateId}
        />
        {showForecast ? (
          <AssetForecastCard assetId={assetId} estateId={estateId} />
        ) : null}
        {showUpcoming ? (
          <AssetUpcoming
            assetId={assetId}
            canSeeInspections={canSeeInspections}
            canSeeService={canSeeService}
            // Beside Condition, or a full-width row under Condition and forecast.
            className={showForecast ? "lg:col-span-2" : undefined}
            estateId={estateId}
            installedOn={asset.data.installedOn}
          />
        ) : null}
      </div>
      {permission?.canViewReadings ? (
        <TrendsCard assetId={assetId} estateId={estateId} />
      ) : null}
    </>
  );
}
