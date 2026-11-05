import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { DetailPageHeader } from "@/components/detail-page-header";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";
import type { Asset } from "@/lib/assets";
import { InspectionRecordAction } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-record-action";

export function AssetDetailsHeader({
  asset,
  assetId,
  estateActive,
  estateId,
  onRetire,
}: {
  asset: Asset;
  assetId: string;
  estateActive: boolean;
  estateId: string;
  onRetire: () => void;
}) {
  const params = { estateId, assetId };
  return (
    <DetailPageHeader
      actions={
        asset.deactivatedAt ? undefined : (
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
              estateActive={estateActive}
              estateId={estateId}
            />
            <Button onClick={onRetire} variant="destructive">
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
        { label: asset.name },
      ]}
      meta={asset.reference}
      status={
        <LifecycleStatusBadge
          inactive={Boolean(asset.deactivatedAt)}
          inactiveLabel="Retired"
        />
      }
      title={asset.name}
    />
  );
}
