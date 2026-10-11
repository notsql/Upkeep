import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  type AssetEventInput,
  assetEventTypeLabel,
  useAssetEvents,
  useRecordAssetEvent,
} from "@/lib/asset-events";
import { RecordEventDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/record-event-dialog";

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
  const recordEvent = useRecordAssetEvent(estateId, assetId);
  const [recording, setRecording] = useState(false);
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
      {events.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading maintenance…
        </p>
      ) : null}
      {events.error ? (
        <p className="mt-4 text-destructive" role="alert">
          {events.error.message}
        </p>
      ) : null}
      {events.data && events.data.length === 0 ? (
        <p className="mt-4 text-muted-foreground text-sm">
          No maintenance recorded yet.
        </p>
      ) : null}
      {events.data?.length ? (
        <ul className="mt-4 grid gap-3">
          {events.data.map((event) => (
            <li className="rounded-lg border p-3 text-sm" key={event.id}>
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {assetEventTypeLabel[event.type]}
                </span>
                <span>· {event.occurredOn}</span>
                {event.countsTowardForecast ? null : (
                  <Badge variant="secondary">Previous unit</Badge>
                )}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{event.notes}</p>
              <p className="mt-2 text-muted-foreground">
                Recorded by {event.recordedByName ?? "Unknown user"} on{" "}
                {new Date(event.createdAt).toLocaleString()}
              </p>
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
