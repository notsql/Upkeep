import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { ReportCard } from "@/components/reports/report-card";
import { useReportList } from "@/lib/reports";

const RECENT_LIMIT = 5;

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card aria-label={label} role="region">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function ReportFaultLink({ estateId }: { estateId?: string }) {
  return (
    <Link
      className={buttonVariants()}
      search={estateId ? { estateId } : {}}
      to="/reports/new"
    >
      Report a fault
    </Link>
  );
}

/** The resident-only account's `/`: report counts and the latest reports. */
export function ResidentDashboard({ estateId }: { estateId?: string }) {
  const reports = useReportList(undefined, estateId);
  const items = reports.data?.items ?? [];
  return (
    <PageLayout>
      <PageHeader
        actions={<ReportFaultLink estateId={estateId} />}
        title="Dashboard"
      />
      {reports.isPending ? <LoadingState label="Loading reports…" /> : null}
      {reports.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>Unable to load reports.</AlertDescription>
        </Alert>
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
              <h2 className="text-xl font-semibold" id="recent-reports">
                Recent reports
              </h2>
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
                action={<ReportFaultLink estateId={estateId} />}
                description="You haven't reported any faults yet."
                icon={ClipboardList}
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
