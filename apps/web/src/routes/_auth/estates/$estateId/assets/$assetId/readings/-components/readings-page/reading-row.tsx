import { Badge } from "@proj/ui/components/badge";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { ReadingProvenance } from "@/components/readings/reading-provenance";
import { deviceMetrics } from "@/lib/devices";
import { type AssetReading, flagLabel } from "@/lib/readings";

export function ReadingRow({ reading }: { reading: AssetReading }) {
  return (
    <TableRow>
      <TableCell>{new Date(reading.measuredAt).toLocaleString()}</TableCell>
      <TableCell>{deviceMetrics[reading.metric].name}</TableCell>
      <TableCell>{`${reading.valueText ?? reading.value} ${reading.unit}`}</TableCell>
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
              variant="outline"
            >
              {flagLabel(flag, reading.unit)}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
