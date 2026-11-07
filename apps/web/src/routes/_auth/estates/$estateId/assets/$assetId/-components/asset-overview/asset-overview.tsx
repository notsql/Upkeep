import { DetailCard } from "@/components/page/detail-card";
import { useAppAccess } from "@/lib/access";
import { useAsset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card";
import { OverviewDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/overview-devices-section";
import { OverviewReadingsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/overview-readings-section";

const NOT_RECORDED = "Not recorded";

export function AssetOverview({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  const categories = useAssetCategories();
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
  return (
    <>
      <DetailCard>
        <div>
          <dt className="font-medium">Reference</dt>
          <dd>{asset.data.reference}</dd>
        </div>
        <div>
          <dt className="font-medium">Category</dt>
          <dd>
            {categories.data?.find(
              (category) => category.code === asset.data.category
            )?.label ?? asset.data.category}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Location</dt>
          <dd>{asset.data.locationPath}</dd>
        </div>
        <div>
          <dt className="font-medium">Installation date</dt>
          <dd>{asset.data.installedOn ?? NOT_RECORDED}</dd>
        </div>
        <div>
          <dt className="font-medium">Manufacturer</dt>
          <dd>{asset.data.manufacturer ?? NOT_RECORDED}</dd>
        </div>
        <div>
          <dt className="font-medium">Model</dt>
          <dd>{asset.data.model ?? NOT_RECORDED}</dd>
        </div>
        <div>
          <dt className="font-medium">Serial number</dt>
          <dd>{asset.data.serialNumber ?? NOT_RECORDED}</dd>
        </div>
      </DetailCard>
      <AssetConditionSection
        assetId={assetId}
        canRecord={assetActive}
        estateId={estateId}
      />
      {owned && asset.data.category === "PUMP" ? (
        <AssetForecastCard assetId={assetId} estateId={estateId} />
      ) : null}
      {canSeeDevices ? (
        <OverviewDevicesSection
          assetId={assetId}
          canRegister={owned && assetActive && !estate.data?.deactivatedAt}
          estateId={estateId}
        />
      ) : null}
      {permission?.canViewReadings ? (
        <OverviewReadingsSection
          assetId={assetId}
          canRecord={permission.canRecordReadings}
          estateId={estateId}
        />
      ) : null}
    </>
  );
}
