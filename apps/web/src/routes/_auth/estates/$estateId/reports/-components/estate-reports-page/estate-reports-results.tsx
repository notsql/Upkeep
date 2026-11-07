import { Badge } from "@proj/ui/components/badge";
import { Link } from "@tanstack/react-router";
import { DuplicateBadges } from "@/components/reports/duplicate-badges";
import { ReportCard } from "@/components/reports/report-card";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import type { useEstateReportList } from "@/lib/estate-reports";
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
  reports: ReturnType<typeof useEstateReportList>;
  cursor: string | undefined;
  filtered: boolean;
  onClear: () => void;
  onRetry: () => void;
  onNext: () => void;
  onFirst: () => void;
}) {
  return (
    <>
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState message="Unable to load reports" onRetry={onRetry} />
      ) : null}
      {reports.data?.items.length === 0 ? (
        <ReportsEmpty filtered={filtered} onClear={onClear} />
      ) : null}
      {reports.isError
        ? null
        : reports.data?.items.map((report) => (
            <ReportCard
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
            >
              {report.routing ? (
                <div>
                  <Badge variant="outline">
                    Routing: {routingStateLabel(report.routing.state)}
                  </Badge>
                </div>
              ) : null}
            </ReportCard>
          ))}
      {reports.data && !reports.isError ? (
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
