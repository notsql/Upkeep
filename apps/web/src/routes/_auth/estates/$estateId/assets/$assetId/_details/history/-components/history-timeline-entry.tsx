import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { type MouseEvent, useCallback } from "react";
import {
  type HistoryDocument,
  type HistoryEntry,
  historyDate,
} from "@/lib/asset-history";
import { HistoryEntryDetails } from "./history-entry-details";

const labels = {
  MAINTENANCE: "Maintenance",
  WORK_ORDER_COMPLETED: "Completed work order",
  CONDITION: "Condition",
  INSPECTION: "Inspection",
  LIFECYCLE: "Lifecycle",
  INVOICE: "Invoice",
  SERVICE_REPORT: "Service report",
};

export function HistoryTimelineEntry({
  entry,
  estateId,
  assetId,
  canViewDocuments,
  canViewInspections,
  canViewWorkOrders,
  onOpen,
}: {
  entry: HistoryEntry;
  estateId: string;
  assetId: string;
  canViewDocuments: boolean;
  canViewInspections: boolean;
  canViewWorkOrders: boolean;
  onOpen: (document: HistoryDocument, trigger: HTMLButtonElement) => void;
}) {
  const open = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (entry.details.kind === "DOCUMENT") {
        onOpen(entry.details.document, event.currentTarget);
      }
    },
    [entry.details, onOpen]
  );
  return (
    <li className="space-y-4 py-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="secondary">{labels[entry.kind]}</Badge>
          <span className="text-muted-foreground text-sm">
            {entry.details.kind === "DOCUMENT" ? "Upload date: " : ""}
            <time dateTime={entry.occurredOn ?? entry.occurredAt ?? undefined}>
              {historyDate(
                entry.occurredOn ?? entry.occurredAt ?? entry.recordedAt,
                !!entry.occurredOn
              )}
            </time>
          </span>
        </div>
        <h3 className="font-medium">{entry.title}</h3>
      </div>
      {entry.summary ? (
        <p className="break-words whitespace-pre-wrap">{entry.summary}</p>
      ) : null}
      <HistoryEntryDetails
        assetId={assetId}
        canViewInspections={canViewInspections}
        canViewWorkOrders={canViewWorkOrders}
        entry={entry}
        estateId={estateId}
      />
      {entry.details.kind === "DOCUMENT" && canViewDocuments ? (
        <Button
          aria-label={`Open ${entry.kind === "INVOICE" ? "invoice" : "service report"} ${entry.details.document.originalFilename}`}
          onClick={open}
          variant="outline"
        >
          Open document
        </Button>
      ) : null}
    </li>
  );
}
