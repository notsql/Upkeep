import { DetailCard } from "@/components/detail-card";
import { useAsset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-condition-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-forecast-card";

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
      {asset.data.category === "PUMP" ? (
        <AssetForecastCard assetId={assetId} estateId={estateId} />
      ) : null}
    </>
  );
}
