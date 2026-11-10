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
import type { ReadingImportRow } from "@/lib/reading-imports";
import { importOutcomeLabels } from "@/lib/reading-imports";
import { badgeVariantFor, readingImportOutcomeTone } from "@/lib/status-tone";
import { useMobile } from "@/lib/use-mobile";

function RowIssues({ row }: { row: ReadingImportRow }) {
  return (
    <ul className="space-y-1">
      {row.issues.map((issue) => (
        <li key={`${issue.field}:${issue.code}`}>
          <Badge
            variant={issue.code === "OUT_OF_RANGE" ? "outline" : "secondary"}
          >
            {issue.code}
          </Badge>
          <p>
            {issue.field}: <span>{issue.reason}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ImportRowResults({ items }: { items: ReadingImportRow[] }) {
  const mobile = useMobile();
  if (!items.length) {
    return null;
  }
  if (mobile) {
    return (
      <ul aria-label="Import results" className="flex flex-col">
        {items.map((row, index) => (
          <li key={row.recordNumber}>
            {index > 0 ? <ItemSeparator className="my-0" /> : null}
            <Item size="sm">
              <ItemContent className="min-w-0">
                <ItemTitle>Record {row.recordNumber}</ItemTitle>
                <ItemDescription className="[overflow-wrap:anywhere]">
                  {[
                    `Line ${row.startingLineNumber}`,
                    ...row.issues.map((issue) => issue.reason),
                  ].join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge
                  variant={badgeVariantFor(
                    readingImportOutcomeTone[row.outcome]
                  )}
                >
                  {importOutcomeLabels[row.outcome]}
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
      aria-label="Import results table"
      className="max-w-full overflow-x-auto" // biome-ignore lint/a11y/noNoninteractiveTabindex: This named overflow region needs keyboard scrolling.
      tabIndex={0}
    >
      <Table aria-label="Import results">
        <TableHeader>
          <TableRow>
            <TableHead>Record</TableHead>
            <TableHead>Starting line</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead>Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.recordNumber}>
              <TableCell>{row.recordNumber}</TableCell>
              <TableCell>{row.startingLineNumber}</TableCell>
              <TableCell>
                <Badge
                  variant={badgeVariantFor(
                    readingImportOutcomeTone[row.outcome]
                  )}
                >
                  {importOutcomeLabels[row.outcome]}
                </Badge>
              </TableCell>
              <TableCell>
                <RowIssues row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
