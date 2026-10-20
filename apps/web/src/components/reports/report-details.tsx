import type { components } from "@proj/api/schema";
import { type ReactNode, useId } from "react";

export function ReportDetails({
  report,
  children,
}: {
  report: components["schemas"]["IssueReportDetailResponse"];
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <section
        aria-labelledby={`${id}-description`}
        className="min-w-0 space-y-2"
      >
        <h3 className="font-semibold" id={`${id}-description`}>
          Description
        </h3>
        <p className="wrap-anywhere whitespace-pre-wrap">
          {report.description}
        </p>
      </section>
      <section aria-labelledby={`${id}-images`} className="min-w-0 space-y-2">
        <h3 className="font-semibold" id={`${id}-images`}>
          Images
        </h3>
        {(report.images?.length ?? 0) === 0 ? (
          <p>No images submitted.</p>
        ) : (
          <div className="grid gap-3">{children}</div>
        )}
      </section>
    </>
  );
}
