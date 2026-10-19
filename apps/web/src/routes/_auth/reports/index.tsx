import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
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
          <Card key={report.id}>
            <CardHeader>
              <CardTitle>
                <h2 className="wrap-anywhere font-semibold">
                  <a href={`/reports/${report.id}`}>{report.title}</a>
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <dl className="flex flex-wrap gap-x-1">
                  <dt className="font-semibold">Estate name:</dt>
                  <dd className="wrap-anywhere">{report.estateName}</dd>
                </dl>
                <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-wrap gap-x-1">
                    <dt className="font-semibold">Location:</dt>
                    <dd className="wrap-anywhere italic">
                      {report.location?.label}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="font-semibold">Status:</dt>
                    <dd>
                      <Badge className="w-fit">{report.status}</Badge>
                    </dd>
                  </div>
                </dl>
                <dl className="flex flex-wrap gap-x-1">
                  <dt className="font-semibold">Submission time:</dt>
                  <dd>
                    <time dateTime={report.createdAt}>
                      {report.createdAt
                        ? new Date(report.createdAt).toLocaleString()
                        : ""}
                    </time>
                  </dd>
                </dl>
              </div>
            </CardContent>
          </Card>
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
