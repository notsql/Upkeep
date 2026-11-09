import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { urgencyLabels } from "@/components/reports/urgency-labels";
import { badgeVariantFor, reportUrgencyTone } from "@/lib/status-tone";

export function ReportUrgencyBadges({
  urgency,
  isSafety,
}: Pick<
  components["schemas"]["EstateIssueReportSummaryResponse"],
  "urgency" | "isSafety"
>) {
  return (
    <dl className="flex flex-wrap items-center gap-2">
      <dt className="font-semibold">Urgency:</dt>
      <dd className="flex flex-wrap gap-2">
        <Badge variant={badgeVariantFor(reportUrgencyTone[urgency])}>
          {urgencyLabels[urgency]}
        </Badge>
        {isSafety ? <Badge variant="destructive">Safety</Badge> : null}
      </dd>
    </dl>
  );
}
