import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ReportCard } from "@/components/reports/report-card";
import { useReportList } from "@/lib/reports";

export const Route = createFileRoute("/_auth/reports/")({
  component: MyReportsPage,
  head: () => ({ meta: [{ title: "My reports" }] }),
});

function MyReportsPage() {
  const [cursor, setCursor] = useState<string>();
  const [previous, setPrevious] = useState<(string | undefined)[]>([]);
  const reports = useReportList(cursor);
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
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-semibold text-2xl">My reports</h1>
        <a className={buttonVariants({ size: "sm" })} href="/reports/new">
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
        <p>No reports yet.</p>
      ) : null}
      <div className="grid gap-4">
        {reports.data?.items?.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            title={<a href={`/reports/${report.id}`}>{report.title}</a>}
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
