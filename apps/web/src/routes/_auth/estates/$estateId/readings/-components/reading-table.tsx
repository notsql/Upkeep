import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { deviceMetrics } from "@/lib/devices";
import { type EstateReading, flagLabel } from "@/lib/readings";

export function ReadingTable({
  items,
  refreshing,
}: {
  items: EstateReading[];
  refreshing: boolean;
}) {
  return (
    <div
      aria-busy={refreshing}
      className="min-w-0 max-w-full overflow-x-auto rounded-xl border"
    >
      <Table aria-label="Readings">
        <TableHeader>
          <TableRow>
            {["Measured", "Asset", "Metric", "Value", "Device", "Flags"].map(
              (label) => (
                <TableHead key={label}>{label}</TableHead>
              )
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((reading) => (
            <TableRow key={reading.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(reading.measuredAt).toLocaleString()}
              </TableCell>
              <TableCell className="min-w-36 max-w-64 whitespace-normal [overflow-wrap:anywhere]">
                <span>{reading.assetReference}</span>
                <p className="text-muted-foreground">{reading.assetName}</p>
              </TableCell>
              <TableCell>{deviceMetrics[reading.metric].name}</TableCell>
              <TableCell className="whitespace-nowrap">
                {reading.value} {reading.unit}
              </TableCell>
              <TableCell className="max-w-48 whitespace-normal [overflow-wrap:anywhere]">
                {reading.deviceIdentifier}
              </TableCell>
              <TableCell>
                <div className="flex min-w-32 flex-wrap items-start gap-1">
                  {reading.flags.map((flag) => (
                    <Badge
                      className="h-auto max-w-full whitespace-normal py-0.5 text-left leading-snug [overflow-wrap:anywhere]"
                      key={flag.type}
                      variant="outline"
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
