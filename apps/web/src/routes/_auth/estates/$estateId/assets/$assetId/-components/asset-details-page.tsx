import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { PageHeader } from "@/components/page-header";
import { useAsset, useDeactivateAsset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-condition-section";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-forecast-card";
import { AssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance-section";
import { AssetRetirementPanel } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-retirement-panel";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";

const NOT_RECORDED = "Not recorded";

export function AssetDetailsPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const categories = useAssetCategories();
  const deactivate = useDeactivateAsset(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const confirm = useCallback(
    async (request: components["schemas"]["DeactivateAssetRequest"]) => {
      await deactivate.mutateAsync(request);
      setConfirming(false);
      toast.success("Asset retired. Its record has been preserved.");
    },
    [deactivate.mutateAsync]
  );
  return (
    <main className="page-layout">
      <Link
        className="text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId"
      >
        Back to estate
      </Link>
      <Link
        className="ml-4 text-sm underline"
        params={{ estateId }}
        to="/estates/$estateId/assets"
      >
        Back to assets
      </Link>
      {asset.isPending ? (
        <p aria-live="polite" className="mt-6">
          Loading asset…
        </p>
      ) : null}
      {asset.error ? (
        <Alert className="mt-6" variant="destructive">
          <AlertDescription>{asset.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {asset.data ? (
        <>
          <PageHeader
            actions={
              asset.data.deactivatedAt ? undefined : (
                <div className="flex flex-wrap items-center gap-4">
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    params={{ estateId, assetId }}
                    to="/estates/$estateId/assets/$assetId/edit"
                  >
                    Edit asset
                  </Link>
                  <Button onClick={openConfirmation} variant="destructive">
                    Retire asset
                  </Button>
                </div>
              )
            }
            breadcrumbs={[
              { label: "Estates", to: "/estates" },
              {
                label: estate.data?.name ?? "Estate",
                to: "/estates/$estateId",
                params: { estateId },
              },
              {
                label: "Assets",
                to: "/estates/$estateId/assets",
                params: { estateId },
              },
              { label: asset.data.name },
            ]}
            description={asset.data.reference}
            status={
              <LifecycleStatusBadge
                inactive={Boolean(asset.data.deactivatedAt)}
                inactiveLabel="Retired"
              />
            }
            title={asset.data.name}
          />
          {asset.data.deactivatedAt ? (
            <Alert className="mt-4" role="note">
              <AlertDescription>
                This asset is retired. Its record remains available but can no
                longer be edited until restored.
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="detail-grid my-4">
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
          </dl>
          <AssetRetirementPanel asset={asset.data} />
          <AssetConditionSection
            assetId={assetId}
            canRecord={!asset.data.deactivatedAt}
            estateId={estateId}
          />
          {asset.data.category === "PUMP" ? (
            <AssetForecastCard assetId={assetId} estateId={estateId} />
          ) : null}
          <AssetMaintenanceSection
            assetId={assetId}
            canRecord={!asset.data.deactivatedAt}
            estateId={estateId}
          />
          <AssetDevicesSection
            assetId={assetId}
            canRegister={!asset.data.deactivatedAt}
            estateId={estateId}
          />
          {confirming ? (
            <DeactivateAssetDialog
              installedOn={asset.data.installedOn}
              lifecycleVersion={asset.data.lifecycleVersion}
              name={asset.data.name}
              onCancel={closeConfirmation}
              onConfirm={confirm}
              reference={asset.data.reference}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
