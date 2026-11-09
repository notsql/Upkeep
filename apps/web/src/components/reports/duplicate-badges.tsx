import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { badgeVariantFor, duplicateReportTone } from "@/lib/status-tone";

type DuplicateState = components["schemas"]["DuplicateOf"]["state"];
type EstateReportSummary =
  components["schemas"]["EstateIssueReportSummaryResponse"];

/** "May already be reported" for a suspected link, "Already reported" for a confirmed one. */
export function DuplicateStateBadge({ state }: { state: DuplicateState }) {
  return state === "CONFIRMED" ? (
    <Badge variant={badgeVariantFor(duplicateReportTone.CONFIRMED)}>
      Already reported
    </Badge>
  ) : (
    <Badge variant={badgeVariantFor(duplicateReportTone.SUSPECTED)}>
      May already be reported
    </Badge>
  );
}

/** Duplicate counts on an original, or the link state on a duplicate (ID-74). */
export function DuplicateBadges({ report }: { report: EstateReportSummary }) {
  const confirmed = report.confirmedDuplicateCount;
  const suspected = report.suspectedDuplicateCount;
  if (!(confirmed || suspected || report.duplicateOf)) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {confirmed > 0 ? (
        <Badge variant={badgeVariantFor(duplicateReportTone.CONFIRMED)}>
          {confirmed} {confirmed === 1 ? "repeat report" : "repeat reports"}
        </Badge>
      ) : null}
      {suspected > 0 ? (
        <Badge variant={badgeVariantFor(duplicateReportTone.SUSPECTED)}>
          {suspected} to review
        </Badge>
      ) : null}
      {report.duplicateOf ? (
        <DuplicateStateBadge state={report.duplicateOf.state} />
      ) : null}
    </div>
  );
}
