import { Badge } from "@proj/ui/components/badge";
import { Gauge } from "lucide-react";
import { ListRow, ListRows } from "@/components/list/list-row";
import { deviceMetrics } from "@/lib/devices";
import { formatDateTime } from "@/lib/format";
import {
  type AssetReading,
  type EstateReading,
  flagLabel,
} from "@/lib/readings";
import { badgeVariantFor, readingFlagTone } from "@/lib/status-tone";

type Reading = AssetReading | EstateReading;

function SourceText({ reading }: { reading: Reading }) {
  if (reading.source === "MANUAL") {
    return (
      <>
        <span>Manual</span> ·{" "}
        <span>
          {reading.recordedByName ||
            `Name unavailable (${reading.recordedByUserId})`}
        </span>
      </>
    );
  }
  if (reading.source === "IMPORT") {
    return (
      <>
        <span>Import</span>
        {reading.sourceLabel ? (
          <>
            {" "}
            · <span>{reading.sourceLabel}</span>
          </>
        ) : null}
        {reading.importBatchId ? (
          <>
            {" "}
            · <span>Batch {reading.importBatchId}</span>
          </>
        ) : null}
      </>
    );
  }
  return (
    <>
      <span>Sensor</span>
      {reading.deviceIdentifier ? (
        <>
          {" "}
          · <span>{reading.deviceIdentifier}</span>
        </>
      ) : null}
    </>
  );
}

/** Phone view of readings: one list item per reading. */
export function ReadingCards({
  items,
  refreshing = false,
}: {
  items: Reading[];
  refreshing?: boolean;
}) {
  return (
    <ListRows busy={refreshing} label="Readings">
      {items.map((reading) => (
        <ListRow
          icon={Gauge}
          key={reading.id}
          meta={
            <>
              <SourceText reading={reading} /> ·{" "}
              <time dateTime={reading.measuredAt}>
                {formatDateTime(reading.measuredAt)}
              </time>
            </>
          }
          title={
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold tabular-nums">
                {reading.valueText ?? reading.value} {reading.unit}
              </span>
              <span>{deviceMetrics[reading.metric].name}</span>
            </span>
          }
          trailing={
            reading.flags.length ? (
              <div className="flex max-w-[45vw] flex-col items-end gap-1">
                {reading.flags.map((flag) => (
                  <Badge
                    className="h-auto max-w-full py-0.5 text-right leading-snug whitespace-normal"
                    key={flag.type}
                    variant={badgeVariantFor(readingFlagTone[flag.type])}
                  >
                    {flagLabel(flag, reading.unit)}
                  </Badge>
                ))}
              </div>
            ) : null
          }
        >
          {"assetReference" in reading ? (
            <p className="text-muted-foreground truncate text-xs">
              <span>{reading.assetName}</span> ·{" "}
              <span>{reading.assetReference}</span>
            </p>
          ) : null}
        </ListRow>
      ))}
    </ListRows>
  );
}
