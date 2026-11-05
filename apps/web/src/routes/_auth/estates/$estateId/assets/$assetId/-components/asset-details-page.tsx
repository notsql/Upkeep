import type { components } from "@proj/api/schema";
import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { DetailPageHeader } from "@/components/detail-page-header";
import { ErrorState } from "@/components/error-state";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { SubNav } from "@/components/sub-nav";
import { useAsset, useDeactivateAsset } from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";
import { InspectionRecordAction } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-record-action";

/** The asset's sub-pages; the old `?tab=` values map onto these paths. */
export const ASSET_SECTIONS = [
  "maintenance",
  "inspections",
  "documents",
  "costs",
  "devices",
] as const;

export type AssetSection = (typeof ASSET_SECTIONS)[number];

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
