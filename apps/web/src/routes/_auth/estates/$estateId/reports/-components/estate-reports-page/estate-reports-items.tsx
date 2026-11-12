import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { ListRows } from "@/components/list/list-row";
import { DuplicateBadges } from "@/components/reports/duplicate-badges";
import { ReportRow } from "@/components/reports/report-row";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";
import { routingStateLabel } from "@/lib/report-routing";
import type { EstateReport } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/estate-reports-table";

/** Mobile: each report as a line item. */
export function EstateReportsItems({
  estateId,
  reports,
}: {
  estateId: string;
  reports: EstateReport[];
}) {
  return (
    <ListRows label="Reports">
      {reports.map((report) => (
        <ReportRow
          badges={<DuplicateBadges report={report} />}
          key={report.id}
          report={report}
          title={
            <Link
              params={{ estateId, reportId: report.id }}
              to="/estates/$estateId/reports/$reportId"
            >
              {report.title}
            </Link>
          }
          urgency={
            <ReportUrgencyBadges
              isSafety={report.isSafety}
              urgency={report.urgency}
            />
          }
        >
          {report.routing ? (
            <div>
              <Badge variant="outline">
                Routing: {routingStateLabel(report.routing.state)}
              </Badge>
            </div>
          ) : null}
        </ReportRow>
      ))}
    </ListRows>
  );
}
