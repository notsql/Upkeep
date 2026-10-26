import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  type InspectionResult,
  useInspectionAccess,
  useInspectionAsset,
  useInspectionPhoto,
  useInspectionResult,
} from "@/lib/inspections";

function InspectionPhoto({
  estateId,
  assetId,
  inspectionId,
  photoId,
  number,
}: {
  estateId: string;
  assetId: string;
  inspectionId: string;
  photoId: string;
  number: number;
}) {
  const image = useInspectionPhoto(estateId, assetId, inspectionId, photoId);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image.data) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(image.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image.data]);
  const retry = useCallback(() => image.refetch(), [image.refetch]);
  if (image.isError) {
    return (
      <div>
        <p>Photo unavailable.</p>
        <Button onClick={retry} variant="outline">
          Retry photo {number}
        </Button>
      </div>
    );
  }
  if (!(url && image.data)) {
    return <p role="status">Loading photo {number}…</p>;
  }
  return (
    <a href={url} rel="noopener" target="_blank">
      <img
        alt={`Inspection evidence ${number}`}
        className="max-h-96 w-full rounded-lg object-contain"
        height={384}
        src={url}
        width={640}
      />
    </a>
  );
}

function InspectionFollowUp({
  record,
  estateId,
  canCreate,
  active,
  pending,
}: {
  record: InspectionResult;
  estateId: string;
  canCreate: boolean;
  active: boolean;
  pending: boolean;
}) {
  if (record.outcome === "PASS") {
    return <p>Closed</p>;
  }
  if (record.workOrder) {
    return (
      <Link
        className="underline"
        params={{ estateId, workOrderId: record.workOrder.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        {record.workOrder.reference}
      </Link>
    );
  }
  return (
    <>
      <p>Awaiting work order</p>
      {canCreate && active ? (
        <Link
          className={buttonVariants()}
          params={{ estateId }}
          search={{ sourceInspectionId: record.id }}
          to="/estates/$estateId/work-orders/new"
        >
          Create work order
        </Link>
      ) : (
        <p>
          {pending
            ? "Loading work-order eligibility…"
            : "Work-order creation is unavailable while the estate, asset or location is inactive, or your creation permission is unavailable."}
        </p>
      )}
    </>
  );
}

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
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Inspection access is unavailable.</p>;
  }
  if (query.isError) {
    return (
      <main className="page-layout">
        <p role="alert">{query.error.message}</p>
        <Button onClick={retry}>Retry inspection</Button>
      </main>
    );
  }
  if (!query.data) {
    return <p role="status">Loading inspection…</p>;
  }
  const record = query.data;
  const active =
    asset.data?.estateActive &&
    asset.data.assetActive &&
    asset.data.locationActive;
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: "/estates/$estateId",
            params: { estateId },
          },
          {
            label: asset.data?.name ?? "Asset",
            to: "/estates/$estateId/assets/$assetId",
            params: { estateId, assetId },
          },
          { label: "Inspection record" },
        ]}
        description={
          asset.data
            ? `${asset.data.reference} · ${asset.data.name}`
            : access.estateName
        }
        title="Inspection record"
      />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <Badge>{record.outcome === "PASS" ? "Pass" : "Fail"}</Badge>
          <dl className="detail-grid">
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
          </dl>
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
        <h2 className="font-semibold text-xl">Photos</h2>
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
    </main>
  );
}
