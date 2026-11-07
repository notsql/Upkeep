import { Badge } from "@proj/ui/components/badge";
import type { EstateReading } from "@/lib/readings";

export function ReadingProvenance({
  reading,
}: {
  reading: Pick<
    EstateReading,
    | "source"
    | "recordedByName"
    | "recordedByUserId"
    | "importBatchId"
    | "sourceLabel"
  >;
}) {
  const manual = reading.source === "MANUAL";
  const imported = reading.source === "IMPORT";
  let label = "Sensor";
  if (manual) {
    label = "Manual";
  }
  if (imported) {
    label = "Import";
  }
  return (
    <div className="max-w-48 min-w-24 space-y-1 [overflow-wrap:anywhere] whitespace-normal">
      <Badge variant={manual ? "secondary" : "outline"}>{label}</Badge>
      {imported ? (
        <div className="text-muted-foreground text-xs">
          <p>{reading.sourceLabel}</p>
          <p>Batch {reading.importBatchId}</p>
        </div>
      ) : null}
      {manual ? (
        <p className="text-muted-foreground text-xs">
          {reading.recordedByName ||
            `Name unavailable (${reading.recordedByUserId})`}
        </p>
      ) : null}
    </div>
  );
}
