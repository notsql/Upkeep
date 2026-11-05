import { buttonVariants } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback } from "react";
import { DetailCard } from "@/components/detail-card";
import { DetailPageHeader } from "@/components/detail-page-header";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { useInspectionAccess, useInspectionAsset } from "@/lib/inspections";
import { InspectionHistoryTable } from "./inspection-history-table";

export function InspectionAssetPage({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useInspectionAccess(estateId);
  const asset = useInspectionAsset(estateId, assetId);
  const retry = useCallback(() => asset.refetch(), [asset.refetch]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Inspection access is unavailable.</p>;
  }
  if (asset.isError) {
    return (
      <PageLayout>
        <ErrorState message={asset.error.message} onRetry={retry} />
      </PageLayout>
    );
  }
  if (!asset.data) {
    return <LoadingState label="Loading asset…" rows={2} />;
  }
  const context = asset.data;
  const active =
    context.assetActive && context.estateActive && context.locationActive;
  return (
    <PageLayout className="space-y-6">
      <DetailPageHeader
        actions={
          access.canCreate && active ? (
            <Link
              className={buttonVariants()}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/inspections/new"
            >
              <Plus aria-hidden="true" />
              Create inspection record
            </Link>
          ) : undefined
        }
        breadcrumbs={[
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          { label: context.name },
        ]}
        meta={context.reference}
        title={context.name}
      />
      <Card>
        <CardContent className="pt-6">
          <DetailCard>
            <div>
              <dt>Reference</dt>
              <dd>{context.reference}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{context.category}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{context.locationPath}</dd>
            </div>
            <div>
              <dt>Installation date</dt>
              <dd>{context.installedOn ?? "Not recorded"}</dd>
            </div>
          </DetailCard>
        </CardContent>
      </Card>
      <InspectionHistoryTable assetId={assetId} estateId={estateId} />
      {active ? null : (
        <p role="note">
          This estate, asset or location is inactive or retired. Saved
          inspections remain available.
        </p>
      )}
    </PageLayout>
  );
}
