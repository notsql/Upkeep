import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { DuplicateBadges } from "@/components/reports/duplicate-badges";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";
import { categoryLabel, routingStateLabel } from "@/lib/report-routing";

export type EstateReport =
  components["schemas"]["EstateIssueReportPageResponse"]["items"][number];

const columns = [
  "Title",
  "Location",
  "Urgency",
  "Duplicates",
  "Type",
  "Next step",
  "Submitted",
];

/** Desktop: one table row per report. */
export function EstateReportsTable({
  estateId,
  reports,
}: {
  estateId: string;
  reports: EstateReport[];
}) {
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-xl border">
      <Table aria-label="Reports">
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.id}>
              <TableCell className="max-w-sm whitespace-normal">
                <Link
                  className="font-medium hover:underline"
                  params={{ estateId, reportId: report.id }}
                  to="/estates/$estateId/reports/$reportId"
                >
                  {report.title}
                </Link>
              </TableCell>
              <TableCell className="whitespace-normal">
                {report.location?.label}
              </TableCell>
              <TableCell>
                <ReportUrgencyBadges
                  isSafety={report.isSafety}
                  urgency={report.urgency}
                />
              </TableCell>
              <TableCell>
                <DuplicateBadges report={report} />
              </TableCell>
              <TableCell>
                {report.routing?.classification?.category ? (
                  <Badge variant="secondary">
                    {categoryLabel(report.routing.classification.category)}
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>
                {report.routing ? (
                  <Badge variant="outline">
                    {routingStateLabel(report.routing.state)}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <time dateTime={report.createdAt}>
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleString()
                    : ""}
                </time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
