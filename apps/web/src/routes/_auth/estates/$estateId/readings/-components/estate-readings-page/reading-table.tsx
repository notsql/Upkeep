import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { ReadingCards } from "@/components/readings/reading-cards";
import { ReadingProvenance } from "@/components/readings/reading-provenance";
import { deviceMetrics } from "@/lib/devices";
import { type EstateReading, flagLabel, flagVariant } from "@/lib/readings";
import { useMobile } from "@/lib/use-mobile";

export function ReadingTable({
  items,
  refreshing,
}: {
  items: EstateReading[];
  refreshing: boolean;
}) {
  const mobile = useMobile();
  if (mobile) {
    return <ReadingCards items={items} refreshing={refreshing} />;
  }
  return (
    <div
      aria-busy={refreshing}
      className="max-w-full min-w-0 overflow-x-auto rounded-xl border"
    >
      <Table aria-label="Readings">
        <TableHeader>
          <TableRow>
            {[
              "Measured",
              "Asset",
              "Metric",
              "Value",
              "Source",
              "Device",
              "Flags",
            ].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((reading) => (
            <TableRow key={reading.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(reading.measuredAt).toLocaleString()}
              </TableCell>
              <TableCell className="max-w-64 min-w-36 [overflow-wrap:anywhere] whitespace-normal">
                <span>{reading.assetReference}</span>
                <p className="text-muted-foreground">{reading.assetName}</p>
              </TableCell>
              <TableCell>{deviceMetrics[reading.metric].name}</TableCell>
              <TableCell className="whitespace-nowrap">
                {reading.valueText ?? reading.value} {reading.unit}
              </TableCell>
              <TableCell>
                <ReadingProvenance reading={reading} />
              </TableCell>
              <TableCell className="max-w-48 min-w-36 [overflow-wrap:anywhere] whitespace-normal">
                {reading.deviceIdentifier ?? "—"}
              </TableCell>
              <TableCell>
                <div className="flex min-w-32 flex-wrap items-start gap-1">
                  {reading.flags.map((flag) => (
                    <Badge
                      className="h-auto max-w-full py-0.5 text-left leading-snug [overflow-wrap:anywhere] whitespace-normal"
                      key={flag.type}
                      variant={flagVariant(flag)}
                    >
                      {flagLabel(flag, reading.unit)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
