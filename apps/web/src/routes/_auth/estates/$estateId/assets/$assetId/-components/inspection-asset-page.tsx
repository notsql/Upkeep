import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
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
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Inspection access is unavailable.</p>;
  }
  if (asset.isError) {
    return (
      <main className="page-layout">
        <p role="alert">{asset.error.message}</p>
        <Button onClick={retry}>Retry asset</Button>
      </main>
    );
  }
  if (!asset.data) {
    return <p role="status">Loading asset…</p>;
  }
  const context = asset.data;
  const active =
    context.assetActive && context.estateActive && context.locationActive;
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        actions={
          access.canCreate && active ? (
            <Link
              className={buttonVariants()}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/inspections/new"
            >
              Create inspection record
            </Link>
          ) : undefined
        }
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: "Assets",
            to: "/estates/$estateId/assets",
            params: { estateId },
          },
          { label: context.name },
        ]}
        description={context.reference}
        title={context.name}
      />
      <Card>
        <CardContent className="pt-6">
          <dl className="detail-grid">
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
          </dl>
        </CardContent>
      </Card>
      <InspectionHistoryTable assetId={assetId} estateId={estateId} />
      {active ? null : (
        <p role="note">
          This estate, asset or location is inactive or retired. Saved
          inspections remain available.
        </p>
      )}
    </main>
  );
}
