import { Badge } from "@proj/ui/components/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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
      <ul aria-label="Import history" className="flex flex-col">
        {items.map((batch, index) => (
          <li key={batch.id}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <Item
              render={
                <Link
                  params={{ estateId, batchId: batch.id }}
                  to="/estates/$estateId/readings/imports/$batchId"
                />
              }
              size="sm"
            >
              <ItemContent className="min-w-0">
                <ItemTitle className="[overflow-wrap:anywhere]">
                  {batch.sourceLabel}
                </ItemTitle>
                <ItemDescription>
                  {new Date(batch.createdAt).toLocaleString()} ·{" "}
                  {batch.importedRows} readings imported
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge
                  variant={
                    batch.status === "REVERTED" ? "outline" : "secondary"
                  }
                >
                  {importStatusLabels[batch.status]}
                </Badge>
              </ItemActions>
            </Item>
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
