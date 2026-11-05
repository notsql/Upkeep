import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { DetailCard } from "@/components/detail-card";
import { ErrorState } from "@/components/error-state";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { LoadingState } from "@/components/loading-state";
import { DetailPageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { SubNav } from "@/components/sub-nav";
import { useAsset, useDeactivateAsset } from "@/lib/assets";
import { useAssetCategories } from "@/lib/catalogue";
import { useEstate } from "@/lib/estates";
import { useInspectionAccess } from "@/lib/inspections";
import { AssetConditionSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-condition-section";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices-section";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-forecast-card";
import { AssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance-section";
import { AssetRetirementPanel } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-retirement-panel";
import { AssetServiceIntervalCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-service-interval-card";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";

const NOT_RECORDED = "Not recorded";

/** The asset's sub-pages; the old `?tab=` values map onto these paths. */
export const ASSET_SECTIONS = [
  "maintenance",
  "inspections",
  "documents",
  "costs",
  "devices",
] as const;

export type AssetSection = (typeof ASSET_SECTIONS)[number];

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

function InspectionRecordAction({
  estateId,
  assetId,
  estateActive,
}: {
  estateId: string;
  assetId: string;
  estateActive: boolean;
}) {
  const access = useInspectionAccess(estateId);
  if (!(access.canCreate && estateActive)) {
    return null;
  }
  return (
    <Link
      className={buttonVariants()}
      params={{ estateId, assetId }}
      to="/estates/$estateId/assets/$assetId/inspections/new"
    >
      <Plus aria-hidden="true" />
      Create inspection record
    </Link>
  );
}

/**
 * The shared frame of every asset sub-page: header, retired note and the
 * section SubNav. `children` (the current sub-page) renders once the asset
 * has loaded.
 */
export function AssetDetailsLayout({
  estateId,
  assetId,
  children,
}: {
  estateId: string;
  assetId: string;
  children: ReactNode;
}) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const deactivate = useDeactivateAsset(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const retry = useCallback(() => asset.refetch(), [asset.refetch]);
  const confirm = useCallback(
    async (request: components["schemas"]["DeactivateAssetRequest"]) => {
      await deactivate.mutateAsync(request);
      setConfirming(false);
      toast.success("Asset retired. Its record has been preserved.");
    },
    [deactivate.mutateAsync]
  );
  const params = { estateId, assetId };
  return (
    <PageLayout>
      {asset.isPending ? (
        <LoadingState label="Loading asset…" rows={2} />
      ) : null}
      {asset.error ? (
        <ErrorState message={asset.error.message} onRetry={retry} />
      ) : null}
      {asset.data ? (
        <>
          <DetailPageHeader
            actions={
              asset.data.deactivatedAt ? undefined : (
                <>
                  <Link
                    className={buttonVariants({ variant: "outline" })}
                    params={params}
                    to="/estates/$estateId/assets/$assetId/edit"
                  >
                    Edit
                  </Link>
                  <InspectionRecordAction
                    assetId={assetId}
                    estateActive={!estate.data?.deactivatedAt}
                    estateId={estateId}
                  />
                  <Button onClick={openConfirmation} variant="destructive">
                    Retire asset
                  </Button>
                </>
              )
            }
            breadcrumbs={[
              {
                label: "Assets",
                to: "/estates/$estateId/assets",
                params: { estateId },
              },
              { label: asset.data.name },
            ]}
            meta={asset.data.reference}
            status={
              <LifecycleStatusBadge
                inactive={Boolean(asset.data.deactivatedAt)}
                inactiveLabel="Retired"
              />
            }
            title={asset.data.name}
          />
          {asset.data.deactivatedAt ? (
            <Alert className="mb-5" role="note">
              <AlertDescription>
                This asset is retired. Its record remains available but can no
                longer be edited until restored.
              </AlertDescription>
            </Alert>
          ) : null}
          <SubNav
            items={[
              {
                exact: true,
                label: "Overview",
                params,
                to: "/estates/$estateId/assets/$assetId",
              },
              {
                label: "Maintenance",
                params,
                to: "/estates/$estateId/assets/$assetId/maintenance",
              },
              {
                label: "Inspections",
                params,
                to: "/estates/$estateId/assets/$assetId/inspections",
              },
              {
                label: "Documents",
                params,
                to: "/estates/$estateId/assets/$assetId/documents",
              },
              {
                label: "Costs",
                params,
                to: "/estates/$estateId/assets/$assetId/costs",
              },
              {
                label: "Devices",
                params,
                to: "/estates/$estateId/assets/$assetId/devices",
              },
            ]}
            label="Asset sections"
          />
          <div className="grid gap-6">{children}</div>
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
    </PageLayout>
  );
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
      <AssetRetirementPanel asset={asset.data} />
    </>
  );
}

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
