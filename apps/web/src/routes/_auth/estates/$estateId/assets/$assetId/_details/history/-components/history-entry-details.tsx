import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import type { HistoryEntry } from "@/lib/asset-history";

function Value({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">
        {value ?? "Not recorded"}
      </dd>
    </div>
  );
}

export function HistoryEntryDetails({
  entry,
  estateId,
  assetId,
  canViewInspections,
  canViewWorkOrders,
}: {
  entry: HistoryEntry;
  estateId: string;
  assetId: string;
  canViewInspections: boolean;
  canViewWorkOrders: boolean;
}) {
  const { details } = entry;
  switch (details.kind) {
    case "CONDITION":
      return (
        <div className="space-y-2">
          <p>
            {(
              {
                GOOD: "Good",
                NEEDS_ATTENTION: "Needs attention",
                FAULTY: "Faulty",
              } as Record<string, string>
            )[details.condition] ?? details.condition}
          </p>
          <Badge variant="secondary">{details.sourceLabel}</Badge>
        </div>
      );
    case "MAINTENANCE":
      return (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Value label="Findings" value={details.findings} />
          <Value label="Work performed" value={details.workPerformed} />
          <Value label="Service provider" value={details.serviceProvider} />
          <Value label="Parts replaced" value={details.partsReplaced} />
          <Value label="Labour cost (SGD)" value={details.labourCost} />
          <Value label="Parts cost (SGD)" value={details.partsCost} />
          <Value label="Other cost (SGD)" value={details.otherCost} />
          <Value label="Total cost (SGD)" value={details.totalCost} />
          <Value label="Downtime (minutes)" value={details.downtimeMinutes} />
        </dl>
      );
    case "COMPLETION":
      return (
        <div className="space-y-3">
          <p>
            {details.reference}{" "}
            {details.editedAt ? <Badge variant="outline">Edited</Badge> : null}
          </p>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Value label="Findings" value={details.findings} />
            <Value label="Work performed" value={details.workPerformed} />
            <Value label="Parts used" value={details.partsUsed} />
            <Value
              label={`Total cost (${details.currency})`}
              value={details.totalCost}
            />
            <Value label="Downtime (minutes)" value={details.downtimeMinutes} />
          </dl>
          {details.canViewWorkOrder && canViewWorkOrders ? (
            <Link
              className="underline"
              params={{ estateId, workOrderId: details.workOrderId }}
              to="/estates/$estateId/work-orders/$workOrderId"
            >
              View work order
            </Link>
          ) : null}
        </div>
      );
    case "INSPECTION":
      return (
        <div className="space-y-2">
          <p>
            {details.outcome === "PASS" ? "Passed" : "Failed"} ·{" "}
            {details.locationPath}
          </p>
          {details.canViewInspection && canViewInspections ? (
            <Link
              className="underline"
              params={{ estateId, assetId, inspectionId: entry.sourceId }}
              to="/estates/$estateId/assets/$assetId/inspections/$inspectionId"
            >
              View inspection
            </Link>
          ) : null}
        </div>
      );
    case "LIFECYCLE":
      return (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Value label="Recorded retirement date" value={details.retiredOn} />
          {details.previousRetiredOn ? (
            <Value
              label="Previous retirement date"
              value={details.previousRetiredOn}
            />
          ) : null}
        </dl>
      );
    case "DOCUMENT":
      return (
        <p className="text-muted-foreground text-sm">
          Original file · {details.document.contentType}
        </p>
      );
    default:
      return null;
  }
}
