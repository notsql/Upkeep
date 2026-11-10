import { Card, CardContent } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import type { ReadingImportBatch } from "@/lib/reading-imports";
import { importStatusLabels } from "@/lib/reading-imports";
import { useMobile } from "@/lib/use-mobile";

export function ImportHistory({
  estateId,
  items,
}: {
  estateId: string;
  items: ReadingImportBatch[];
}) {
  const mobile = useMobile();
  if (!items.length) {
    return null;
  }
  if (mobile) {
    return (
      <ul aria-label="Import history" className="space-y-3">
        {items.map((batch) => (
          <li key={batch.id}>
            <Card>
              <CardContent>
                <Link
                  params={{ estateId, batchId: batch.id }}
                  to="/estates/$estateId/readings/imports/$batchId"
                >
                  {batch.sourceLabel}
                </Link>
                <p>
                  {importStatusLabels[batch.status]} · {batch.importedRows}{" "}
                  imported
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section
      aria-label="Import history"
      className="max-w-full overflow-x-auto"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: This named overflow region needs keyboard scrolling.
      tabIndex={0}
    >
      <Table aria-label="Import history">
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Imported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>
                <Link
                  params={{ estateId, batchId: batch.id }}
                  to="/estates/$estateId/readings/imports/$batchId"
                >
                  {batch.sourceLabel}
                </Link>
              </TableCell>
              <TableCell>
                {new Date(batch.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>{importStatusLabels[batch.status]}</TableCell>
              <TableCell>{batch.importedRows}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
