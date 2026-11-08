import { DetailCard } from "@/components/page/detail-card";
import { useAsset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { AnomalyAlertsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/anomaly-alerts-section/anomaly-alerts-section";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card";

const NOT_RECORDED = "Not recorded";

/** Why anomaly alerts are read-only, if they are. */
function alertLock(
  estateInactive: boolean,
  assetRetired: boolean
): string | undefined {
  if (estateInactive) {
    return "This estate is inactive, so its alerts cannot be changed.";
  }
  if (assetRetired) {
    return "This asset is retired, so its alerts cannot be changed.";
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
  const categories = useAssetCategories();
  const estate = useEstate(estateId);
  const manages = Boolean(
    estate.data?.owned || estate.data?.canManageInvitationPermissions
  );
  if (!asset.data) {
    return null;
  }
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
        canRecord={!asset.data.deactivatedAt}
        estateId={estateId}
      />
      {asset.data.category === "PUMP" && manages ? (
        <AnomalyAlertsSection
          assetId={assetId}
          estateId={estateId}
          locked={alertLock(
            Boolean(estate.data?.deactivatedAt),
            Boolean(asset.data.deactivatedAt)
          )}
        />
      ) : null}
      {asset.data.category === "PUMP" ? (
        <AssetForecastCard assetId={assetId} estateId={estateId} />
      ) : null}
    </>
  );
}
