import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard } from "lucide-react";
import { useCallback } from "react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SectionHeading } from "@/components/page/section-heading";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useReportList } from "@/lib/reports";
import { CountCard } from "@/routes/-components/home-page/resident-home/count-card";
import { ReportFaultLink } from "@/routes/-components/home-page/resident-home/report-fault-link";

const RECENT_LIMIT = 5;

/** The resident-only account's `/`: report counts and the latest reports. */
export function ResidentDashboard({ estateId }: { estateId?: string }) {
  const reports = useReportList(undefined, estateId);
  const items = reports.data?.items ?? [];
  const retry = useCallback(() => {
    reports.refetch();
  }, [reports]);
  return (
    <PageLayout>
      <PageHeader
        actions={<ReportFaultLink estateId={estateId} />}
        icon={LayoutDashboard}
        title="Dashboard"
      />
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <ErrorState message="Unable to load reports" onRetry={retry} />
      ) : null}
      {reports.data ? (
        <div className="grid gap-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <CountCard label="Open" value={reports.data.counts.open} />
            <CountCard
              label="In progress"
              value={reports.data.counts.inProgress}
            />
            <CountCard label="Resolved" value={reports.data.counts.resolved} />
          </div>
          <section aria-labelledby="recent-reports" className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionHeading icon={ClipboardList} id="recent-reports">
                Recent reports
              </SectionHeading>
              {items.length > 0 ? (
                <Link
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  search={estateId ? { estateId } : {}}
                  to="/reports"
                >
                  View all
                </Link>
              ) : null}
            </div>
            {items.length === 0 ? (
              <EmptyState
                description="Use Report a fault to send the first one"
                title="No reports yet"
              />
            ) : (
              items.slice(0, RECENT_LIMIT).map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  title={
                    <Link
                      params={{ reportId: report.id }}
                      search={estateId ? { estateId } : {}}
                      to="/reports/$reportId"
                    >
                      {report.title}
                    </Link>
                  }
                />
              ))
            )}
          </section>
        </div>
      ) : null}
    </PageLayout>
  );
}
