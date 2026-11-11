import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { ListRows } from "@/components/list/list-row";
import { DuplicateBadges } from "@/components/reports/duplicate-badges";
import { ReportRow } from "@/components/reports/report-row";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import { ReportRequestError } from "@/lib/estate-reports";
import type { PagedList } from "@/lib/infinite-list";
import { routingStateLabel } from "@/lib/report-routing";
import { ReportsEmpty } from "@/routes/_auth/estates/$estateId/reports/-components/estate-reports-page/reports-empty";

export function EstateReportsResults({
  estateId,
  reports,
  cursor,
  filtered,
  onClear,
  onRetry,
  onNext,
  onFirst,
}: {
  estateId: string;
  reports: PagedList<components["schemas"]["EstateIssueReportPageResponse"]>;
  cursor: string | undefined;
  filtered: boolean;
  onClear: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFirst: () => void;
}) {
  const rejectedPage =
    !!cursor &&
    reports.error instanceof ReportRequestError &&
    reports.error.status === 400;
  return (
    <>
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState
          message={
            rejectedPage
              ? "Couldn't load this report page. Return to the first page."
              : "Couldn't load reports. Try again."
          }
          onRetry={rejectedPage ? onFirst : onRetry}
          retryLabel={rejectedPage ? "Return to first page" : "Retry"}
        />
      ) : null}
      {reports.data?.items.length === 0 ? (
        <ReportsEmpty filtered={filtered} onClear={onClear} />
      ) : null}
      {reports.isError || !reports.data?.items.length ? null : (
        <ListRows label="Reports">
          {reports.data.items.map((report) => (
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
      )}
      {reports.data && !reports.isError && reports.more ? (
        <LoadMore {...reports.more} />
      ) : null}
      {reports.data && !reports.isError && !reports.more ? (
        <Pagination
          canNext={!!reports.data.nextCursor}
          canPrevious={!!cursor}
          label="Report pages"
          onNext={onNext}
          onPrevious={onFirst}
        />
      ) : null}
    </>
  );
}
