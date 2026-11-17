import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { urgencyLabels } from "@/components/reports/urgency-labels";
import { badgeVariantFor, reportUrgencyTone } from "@/lib/status-tone";

/**
 * The urgency badge, plus Safety when flagged. `labelled` adds an "Urgency:"
 * label for places with no column header or row label, like the phone list.
 */
export function ReportUrgencyBadges({
  urgency,
  isSafety,
  labelled = false,
}: Pick<
  components["schemas"]["EstateIssueReportSummaryResponse"],
  "urgency" | "isSafety"
> & { labelled?: boolean }) {
  const badges = (
    <>
      <Badge variant={badgeVariantFor(reportUrgencyTone[urgency])}>
        {urgencyLabels[urgency]}
      </Badge>
      {isSafety ? <Badge variant="destructive">Safety</Badge> : null}
    </>
  );
  if (!labelled) {
    return <div className="flex flex-wrap items-center gap-2">{badges}</div>;
  }
  return (
    <dl className="flex flex-wrap items-center gap-2">
      <dt className="font-semibold">Urgency:</dt>
      <dd className="flex flex-wrap gap-2">{badges}</dd>
    </dl>
  );
}
