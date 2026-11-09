import { Badge } from "@proj/ui/components/badge";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { ReadingImportRow } from "@/lib/reading-imports";
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
      <ul aria-label="Import results" className="mt-5 space-y-3">
        {items.map((row) => (
          <li key={row.recordNumber}>
            <Card>
              <CardContent>
                <dl>
                  <dt>Record</dt>
                  <dd>{row.recordNumber}</dd>
                  <dt>Starting line</dt>
                  <dd>{row.startingLineNumber}</dd>
                  <dt>Outcome</dt>
                  <dd>
                    <Badge
                      variant={badgeVariantFor(
                        readingImportOutcomeTone[row.outcome]
                      )}
                    >
                      {row.outcome}
                    </Badge>
                  </dd>
                </dl>
                <RowIssues row={row} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <section
      aria-label="Import results table"
      className="mt-5 max-w-full overflow-x-auto" // biome-ignore lint/a11y/noNoninteractiveTabindex: This named overflow region needs keyboard scrolling.
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
                  {row.outcome}
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
