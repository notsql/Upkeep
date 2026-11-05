import { Badge } from "@proj/ui/components/badge";
import { type AssetEvent, assetEventTypeLabel } from "@/lib/asset-events";
import { ManualDetails } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/manual-details";

export function AssetMaintenanceManualEntry({ event }: { event: AssetEvent }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Manual entry</Badge>
        <span className="font-medium">{assetEventTypeLabel[event.type]}</span>
        <span>· {event.occurredOn}</span>
        {event.countsTowardForecast ? null : (
          <Badge variant="secondary">Previous unit</Badge>
        )}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{event.notes}</p>
      <ManualDetails event={event} />
      <p className="text-muted-foreground mt-2">
        Recorded by {event.recordedByName ?? "Unknown user"} on{" "}
        {new Date(event.createdAt).toLocaleString()}
      </p>
    </>
  );
}
