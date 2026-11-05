import { Alert, AlertDescription } from "@proj/ui/components/alert";
import type { ReactNode } from "react";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AssetDetailsHeader } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-header";
import { AssetDetailsNav } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-nav";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/deactivate-asset-dialog";
import { useAssetDetailsLayout } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/use-asset-details-layout";

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
  const {
    asset,
    closeConfirmation,
    confirm,
    confirming,
    estate,
    openConfirmation,
    retry,
  } = useAssetDetailsLayout(estateId, assetId);
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
          <AssetDetailsHeader
            asset={asset.data}
            assetId={assetId}
            estateActive={!estate.data?.deactivatedAt}
            estateId={estateId}
            onRetire={openConfirmation}
          />
          {asset.data.deactivatedAt ? (
            <Alert className="mb-5" role="note">
              <AlertDescription>
                This asset is retired. Its record remains available but can no
                longer be edited until restored.
              </AlertDescription>
            </Alert>
          ) : null}
          <AssetDetailsNav assetId={assetId} estateId={estateId} />
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
