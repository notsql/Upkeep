import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import type { Asset } from "@/lib/assets";

/** Title, status and reference only; actions live on the tabs. */
export function AssetDetailsHeader({
  asset,
  estateId,
}: {
  asset: Asset;
  estateId: string;
}) {
  return (
    <DetailPageHeader
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
