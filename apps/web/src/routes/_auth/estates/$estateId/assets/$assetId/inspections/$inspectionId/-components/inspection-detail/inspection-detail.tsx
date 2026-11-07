import { Badge } from "@proj/ui/components/badge";
import { Card, CardContent } from "@proj/ui/components/card";
import { useCallback } from "react";
import { DetailCard } from "@/components/page/detail-card";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  useInspectionAccess,
  useInspectionAsset,
  useInspectionResult,
} from "@/lib/inspections";
import { InspectionFollowUp } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail/inspection-follow-up";
import { InspectionPhoto } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail/inspection-photo";

export function InspectionDetail({
  estateId,
  assetId,
  inspectionId,
}: {
  estateId: string;
  assetId: string;
  inspectionId: string;
}) {
  const access = useInspectionAccess(estateId);
  const query = useInspectionResult(estateId, assetId, inspectionId);
  const asset = useInspectionAsset(estateId, assetId);
  const retry = useCallback(() => query.refetch(), [query.refetch]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Inspection access is unavailable.</p>;
  }
  if (query.isError) {
    return (
      <PageLayout>
        <ErrorState
          message={query.error.message}
          onRetry={retry}
          retryLabel="Retry inspection"
        />
      </PageLayout>
    );
  }
  if (!query.data) {
    return <LoadingState label="Loading inspection…" rows={2} />;
  }
  const record = query.data;
  const active =
    asset.data?.estateActive &&
    asset.data.assetActive &&
    asset.data.locationActive;
  return (
    <PageLayout className="space-y-6">
      <DetailPageHeader
        breadcrumbs={[
          {
            label: asset.data?.name ?? "Asset",
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Inspection record" },
        ]}
        meta={
          asset.data
            ? `${asset.data.reference} · ${asset.data.name}`
            : undefined
        }
        status={<Badge>{record.outcome === "PASS" ? "Pass" : "Fail"}</Badge>}
        title="Inspection record"
      />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <DetailCard>
            <div>
              <dt>Inspection date</dt>
              <dd>
                <time dateTime={record.inspectedOn}>{record.inspectedOn}</time>
              </dd>
            </div>
            <div>
              <dt>Recorded location</dt>
              <dd>{record.locationPath}</dd>
            </div>
            <div>
              <dt>Inspector</dt>
              <dd>{record.recordedByName ?? "Inspector unavailable"}</dd>
            </div>
            <div>
              <dt>Recorded at</dt>
              <dd>
                <time dateTime={record.createdAt}>
                  {new Intl.DateTimeFormat("en-SG", {
                    timeZone: "Asia/Singapore",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(record.createdAt))}{" "}
                  (Singapore)
                </time>
              </dd>
            </div>
          </DetailCard>
          <div>
            <h2 className="font-semibold">Notes</h2>
            <p className="whitespace-pre-wrap">
              {record.notes ?? "No notes recorded."}
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold">Follow-up</h2>
            <InspectionFollowUp
              active={!!active}
              canCreate={access.canCreateWorkOrders}
              estateId={estateId}
              pending={asset.isPending}
              record={record}
            />
          </div>
        </CardContent>
      </Card>
      <section aria-label="Inspection photos" className="space-y-4">
        <h2 className="text-xl font-semibold">Photos</h2>
        {record.photos.length === 0 ? (
          <p>No photos recorded.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {record.photos.map((photo, index) => (
              <InspectionPhoto
                assetId={assetId}
                estateId={estateId}
                inspectionId={inspectionId}
                key={photo.id}
                number={index + 1}
                photoId={photo.id}
              />
            ))}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
