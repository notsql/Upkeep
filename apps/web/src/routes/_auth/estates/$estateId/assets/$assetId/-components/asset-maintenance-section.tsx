import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Empty } from "@proj/ui/components/empty";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CompletionOutcome } from "@/components/work-order-completion";
import {
  type AssetEvent,
  type AssetEventInput,
  assetEventTypeLabel,
  useAssetEvents,
  useRecordAssetEvent,
} from "@/lib/asset-events";
import {
  useAssetWorkOrderCompletions,
  useWorkOrderAccess,
} from "@/lib/work-orders";
import { RecordEventDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/record-event-dialog";

function ManualDetails({ event }: { event: AssetEvent }) {
  const details = [
    ["Findings", event.findings],
    ["Work performed", event.workPerformed],
    ["Service provider", event.serviceProvider],
    ["Parts replaced", event.partsReplaced],
    ["Downtime (minutes)", event.downtimeMinutes?.toString()],
  ].filter(
    (detail): detail is [string, string] => typeof detail[1] === "string"
  );
  if (details.length === 0) {
    return null;
  }
  return (
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {details.map(([term, value]) => (
        <div key={term}>
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AssetMaintenanceSection({
  assetId,
  canRecord,
  estateId,
}: {
  assetId: string;
  canRecord: boolean;
  estateId: string;
}) {
  const events = useAssetEvents(estateId, assetId);
  const completions = useAssetWorkOrderCompletions(estateId, assetId);
  const access = useWorkOrderAccess(estateId);
  const entries = [
    ...(events.data ?? []).map((event) => ({
      kind: "manual" as const,
      id: event.id,
      at: event.occurredOn,
      event,
    })),
    ...(completions.data ?? []).map((work) => ({
      kind: "work" as const,
      id: work.completion.id,
      at: work.completion.completedAt,
      work,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const recordEvent = useRecordAssetEvent(estateId, assetId);
  const [recording, setRecording] = useState(false);
  const retryCompletions = useCallback(
    () => completions.refetch(),
    [completions.refetch]
  );
  const open = useCallback(() => setRecording(true), []);
  const cancel = useCallback(() => setRecording(false), []);
  const save = useCallback(
    async (values: AssetEventInput) => {
      await recordEvent.mutateAsync(values);
      setRecording(false);
      toast.success("Event recorded.");
    },
    [recordEvent.mutateAsync]
  );

  return (
    <section
      aria-labelledby="maintenance-heading"
      className="section-surface mt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id="maintenance-heading">
          Maintenance
        </h2>
        {canRecord ? (
          <Button onClick={open} variant="outline">
            Record repair
          </Button>
        ) : null}
      </div>
      {events.isPending || completions.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading maintenance…
        </p>
      ) : null}
      {events.error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>{events.error.message}</AlertDescription>
        </Alert>
      ) : null}
      {completions.error ? (
        <Alert className="mt-4" variant="destructive">
          <AlertDescription>
            {completions.error.message}
            <Button onClick={retryCompletions} variant="outline">
              Retry completed work
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {events.data && completions.data && entries.length === 0 ? (
        <Empty className="mt-4 border border-dashed" role="status">
          No maintenance recorded yet.
        </Empty>
      ) : null}
      {entries.length ? (
        <ul className="mt-4 grid gap-3">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              <Card size="sm">
                <CardContent>
                  {entry.kind === "manual" ? (
                    <>
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Manual entry</Badge>
                        <span className="font-medium">
                          {assetEventTypeLabel[entry.event.type]}
                        </span>
                        <span>· {entry.event.occurredOn}</span>
                        {entry.event.countsTowardForecast ? null : (
                          <Badge variant="secondary">Previous unit</Badge>
                        )}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">
                        {entry.event.notes}
                      </p>
                      <ManualDetails event={entry.event} />
                      <p className="mt-2 text-muted-foreground">
                        Recorded by{" "}
                        {entry.event.recordedByName ?? "Unknown user"} on{" "}
                        {new Date(entry.event.createdAt).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Work order</Badge>
                        {access.canView ? (
                          <Link
                            className="text-primary underline underline-offset-4"
                            params={{
                              estateId,
                              workOrderId: entry.work.workOrderId,
                            }}
                            to="/estates/$estateId/work-orders/$workOrderId"
                          >
                            {entry.work.reference}
                          </Link>
                        ) : (
                          entry.work.reference
                        )}
                      </p>
                      <p className="mb-4">
                        Work location: {entry.work.locationPath}
                      </p>
                      <CompletionOutcome completion={entry.work.completion} />
                    </>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
      {recording && canRecord ? (
        <RecordEventDialog
          defaultType="BREAKDOWN_REPAIR"
          onCancel={cancel}
          onSave={save}
        />
      ) : null}
    </section>
  );
}
