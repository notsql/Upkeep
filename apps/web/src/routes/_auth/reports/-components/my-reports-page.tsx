import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";

import { useCallback, useState } from "react";
import { ReportCard } from "@/components/reports/report-card";
import { useAuthenticatedSession } from "@/lib/access";
import { useReportList } from "@/lib/reports";

interface HistoryProps {
  estateId?: string;
  estateName?: string;
}
export function MyReportsPage(props: HistoryProps) {
  const { userId } = useAuthenticatedSession();
  return (
    <ReportHistory key={`${userId}:${props.estateId ?? "all"}`} {...props} />
  );
}
function ReportHistory({ estateId, estateName }: HistoryProps) {
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const reports = useReportList(cursor, estateId);
  const retry = useCallback(() => reports.refetch(), [reports.refetch]);
  const goPrevious = useCallback(() => {
    setCursor(previous.at(-1));
    setPrevious((pages) => pages.slice(0, -1));
  }, [previous]);
  const goNext = useCallback(() => {
    setPrevious((pages) => [...pages, cursor]);
    setCursor(reports.data?.nextCursor ?? undefined);
  }, [cursor, reports.data?.nextCursor]);

  return (
    <main className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">My reports</h1>
          <p className="page-description wrap-anywhere">
            {estateName ??
              (estateId
                ? "Your reports for the selected estate."
                : "Your reports across all estates.")}
          </p>
        </div>
        <a
          className={buttonVariants({ size: "sm" })}
          href={
            estateId
              ? `/reports/new?estateId=${encodeURIComponent(estateId)}`
              : "/reports/new"
          }
        >
          Report a fault
        </a>
      </div>
      {reports.isPending ? <p role="status">Loading reports…</p> : null}
      {reports.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Unable to load reports.{" "}
            <Button onClick={retry} type="button" variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {reports.data && (reports.data.items?.length ?? 0) === 0 ? (
        <p>
          {estateId ? "No reports for this estate yet." : "No reports yet."}
        </p>
      ) : null}
      <div className="grid gap-4">
        {reports.data?.items?.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            title={
              <a
                href={`/reports/${report.id}${estateId ? `?estateId=${encodeURIComponent(estateId)}` : ""}`}
              >
                {report.title}
              </a>
            }
          />
        ))}
      </div>
      {reports.data ? (
        <div className="mt-4 flex gap-2">
          {previous.length > 0 ? (
            <Button onClick={goPrevious} variant="outline">
              Previous
            </Button>
          ) : null}
          {reports.data.nextCursor ? (
            <Button onClick={goNext} variant="outline">
              Next
            </Button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
