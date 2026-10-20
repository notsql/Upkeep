import type { components } from "@proj/api/schema";
import { Badge } from "@proj/ui/components/badge";
import type { ReactNode } from "react";

export function ReportMetadata({
  report,
  locationAction,
  showUpdated = false,
}: {
  report: components["schemas"]["IssueReportSummaryResponse"];
  locationAction?: ReactNode;
  showUpdated?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <dl className="flex flex-wrap gap-x-1">
        <dt className="font-semibold">Estate name:</dt>
        <dd className="wrap-anywhere">{report.estateName}</dd>
      </dl>
      <dl className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap gap-x-1">
          <dt className="font-semibold">Location:</dt>
          <dd className="wrap-anywhere italic">{report.location?.label}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-semibold">Status:</dt>
          <dd>
            <Badge className="w-fit">{report.status}</Badge>
          </dd>
        </div>
      </dl>
      {locationAction}
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
      {showUpdated ? (
        <dl className="flex flex-wrap gap-x-1">
          <dt className="font-semibold">Updated:</dt>
          <dd>
            <time dateTime={report.updatedAt}>
              {new Date(report.updatedAt).toLocaleString()}
            </time>
          </dd>
        </dl>
      ) : null}
    </div>
  );
}
