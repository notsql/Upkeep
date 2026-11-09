import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { canOpenInspections } from "@/lib/estate-destinations";
import { useEstate } from "@/lib/estates";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { AnomalyAlertsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/anomaly-alerts-section/anomaly-alerts-section";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card";
import { AssetSummary } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-summary";
import { AssetUpcomingList } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-upcoming/asset-upcoming";
import { DevicesOnlineStat } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/devices-online-stat";
import { TrendsCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-card";

/** Why anomaly alerts are read-only, if they are. */
function alertLock(
  estateInactive: boolean,
  assetRetired: boolean
): string | undefined {
  if (estateInactive) {
    return "This estate is inactive, so its alerts cannot be changed.";
  }
  if (assetRetired) {
    return "This asset is out of use, so you can't change its alerts.";
  }
}

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
  const workOrders = useWorkOrderAccess(estateId);
  if (!asset.data) {
    return null;
  }
  // Each section mounts only for viewers its endpoint serves, so none 403s.
  const owned = Boolean(estate.data?.owned);
  const permission = access.data?.estates.find(
    (item) => item.estateId === estateId
  );
  const assetActive = !asset.data.deactivatedAt;
  // Owners and Managers send crew to judge the condition rather than judging it themselves.
  const canSend =
    assetActive && !estate.data?.deactivatedAt && workOrders.canCreate;
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
          showForecast ? "grid items-stretch gap-6 lg:grid-cols-2" : "grid"
        }
      >
        <AssetConditionSection
          assetId={assetId}
          canRecord={assetActive && !canSend}
          estateId={estateId}
          upcoming={
            showUpcoming ? (
              <AssetUpcomingList
                assetId={assetId}
                canSeeInspections={canSeeInspections}
                canSeeService={canSeeService}
                estateId={estateId}
                installedOn={asset.data.installedOn}
              />
            ) : undefined
          }
        />
        {showForecast ? (
          <AssetForecastCard
            assetId={assetId}
            assetName={asset.data.name}
            canSend={canSend}
            estateId={estateId}
          />
        ) : null}
      </div>
      {asset.data.category === "PUMP" && canSeeService ? (
        <AnomalyAlertsSection
          assetId={assetId}
          estateId={estateId}
          locked={alertLock(
            Boolean(estate.data?.deactivatedAt),
            Boolean(asset.data.deactivatedAt)
          )}
        />
      ) : null}
      {permission?.canViewReadings ? (
        <TrendsCard assetId={assetId} estateId={estateId} />
      ) : null}
    </>
  );
}
