import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";

type DuplicateState = components["schemas"]["DuplicateOf"]["state"];
type EstateReportSummary =
  components["schemas"]["EstateIssueReportSummaryResponse"];

/** "Possible duplicate" for a suspected link, "Duplicate" for a confirmed one. */
export function DuplicateStateBadge({ state }: { state: DuplicateState }) {
  return state === "CONFIRMED" ? (
    <Badge variant="secondary">Duplicate</Badge>
  ) : (
    <Badge variant="outline">Possible duplicate</Badge>
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
        <Badge variant="secondary">
          {confirmed} {confirmed === 1 ? "duplicate" : "duplicates"}
        </Badge>
      ) : null}
      {suspected > 0 ? (
        <Badge variant="outline">{suspected} to review</Badge>
      ) : null}
      {report.duplicateOf ? (
        <DuplicateStateBadge state={report.duplicateOf.state} />
      ) : null}
    </div>
  );
}
