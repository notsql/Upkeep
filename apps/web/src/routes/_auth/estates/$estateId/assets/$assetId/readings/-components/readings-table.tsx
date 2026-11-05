import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { AssetReading } from "@/lib/readings";
import { ReadingRow } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/reading-row";

export function ReadingsTable({ readings }: { readings: AssetReading[] }) {
  return (
    <Table aria-label="Readings">
      <TableHeader>
        <TableRow>
          {["Measured", "Metric", "Value", "Source", "Device", "Flags"].map(
            (label) => (
              <TableHead key={label}>{label}</TableHead>
            )
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {readings.map((reading) => (
          <ReadingRow key={reading.id} reading={reading} />
        ))}
      </TableBody>
    </Table>
  );
}
