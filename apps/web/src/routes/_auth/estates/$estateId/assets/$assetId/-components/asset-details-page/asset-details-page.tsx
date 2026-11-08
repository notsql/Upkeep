import { Alert, AlertDescription } from "@proj/ui/components/alert";
import type { ReactNode } from "react";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AssetAttentionAlert } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-attention-alert";
import { AssetDetailsHeader } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-header";
import { AssetDetailsNav } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-nav";
import { useAssetDetailsLayout } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/use-asset-details-layout";

/** The asset's sub-pages. */
export type AssetSection = "details" | "records" | "costs" | "devices";

/** Old `?tab=` values and the sub-page each now lives on. */
export const LEGACY_TABS: Record<string, AssetSection> = {
  details: "details",
  maintenance: "records",
  inspections: "records",
  documents: "records",
  costs: "costs",
  devices: "devices",
};

/**
 * The shared frame of every asset sub-page: header, attention banner,
 * retired note and the section SubNav. `children` (the current sub-page) renders once the asset
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
  const { asset, canInspect, retry } = useAssetDetailsLayout(estateId, assetId);
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
          <AssetDetailsHeader asset={asset.data} estateId={estateId} />
          <AssetAttentionAlert
            assetId={assetId}
            canInspect={canInspect}
            estateId={estateId}
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
        </>
      ) : null}
    </PageLayout>
  );
}
