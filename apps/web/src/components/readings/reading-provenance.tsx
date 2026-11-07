import { Badge } from "@proj/ui/components/badge";
import type { EstateReading } from "@/lib/readings";

export function ReadingProvenance({
  reading,
}: {
  reading: Pick<
    EstateReading,
    "source" | "recordedByName" | "recordedByUserId"
  >;
}) {
  const manual = reading.source === "MANUAL";
  return (
    <div className="max-w-48 min-w-24 space-y-1 [overflow-wrap:anywhere] whitespace-normal">
      <Badge variant={manual ? "secondary" : "outline"}>
        {manual ? "Manual" : "Sensor"}
      </Badge>
      {manual ? (
        <p className="text-muted-foreground text-xs">
          {reading.recordedByName ||
            `Name unavailable (${reading.recordedByUserId})`}
        </p>
      ) : null}
    </div>
  );
}
