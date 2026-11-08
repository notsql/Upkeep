import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { HeartPulse } from "lucide-react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import { useAsset } from "@/lib/assets";
import { useInspectionAccess } from "@/lib/inspections";
import { ConditionHistoryList } from "@/routes/_auth/estates/$estateId/assets/$assetId/condition/-components/condition-history-list";

/**
 * Every assessment of one asset, newest first. It sits outside the asset's
 * tabbed layout (like Readings) and leads back to it through the breadcrumbs.
 * Only viewers of the asset pages see condition, so the same gate applies.
 */
export function AssetConditionHistoryPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useInspectionAccess(estateId);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canViewAssets) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Asset access is unavailable.</AlertDescription>
      </Alert>
    );
  }
  return <ConditionHistoryContent assetId={assetId} estateId={estateId} />;
}

/** Mounted only once access is known, so no request is refused. */
function ConditionHistoryContent({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const asset = useAsset(estateId, assetId);
  return (
    <PageLayout>
      <PageHeader
        breadcrumbs={[
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          {
            label: asset.data?.name ?? "Asset",
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Condition history" },
        ]}
        description="Every assessment, newest first"
        icon={HeartPulse}
        title="Condition history"
      />
      <ConditionHistoryList assetId={assetId} estateId={estateId} />
    </PageLayout>
  );
}
