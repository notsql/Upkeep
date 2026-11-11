import type { components } from "@proj/api/schema";
import { MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";
import { ListRow } from "@/components/list/list-row";
import { ReportMetadata } from "@/components/reports/report-metadata";

/** One report in a flat report list: the title links to the report. */
export function ReportRow({
  report,
  title,
  badges,
  urgency,
  children,
}: {
  report: components["schemas"]["IssueReportSummaryResponse"];
  title: ReactNode;
  badges?: ReactNode;
  urgency?: ReactNode;
  /** Extra content below the metadata, e.g. a routing badge. */
  children?: ReactNode;
}) {
  return (
    <ListRow
      icon={MessageSquareWarning}
      title={<h2 className="wrap-anywhere">{title}</h2>}
      trailing={badges}
    >
      <ReportMetadata report={report} urgency={urgency} />
      {children}
    </ListRow>
  );
}
