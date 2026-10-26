import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";

import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { useReport } from "@/lib/reports";
import { PrivateReportImage } from "./-components/private-report-image";

export const Route = createFileRoute("/_auth/reports/$reportId/")({
  validateSearch: (search: Record<string, unknown>): { estateId?: string } => ({
    ...(typeof search.estateId === "string" && search.estateId
      ? { estateId: search.estateId }
      : {}),
  }),
  component: ReportDetailPage,
  head: () => ({ meta: [{ title: "Report details" }] }),
});

function ReportDetailPage() {
  const { reportId } = useParams({ strict: false });
  const { estateId } = useSearch({ strict: false });
  const report = useReport(reportId ?? "");
  return (
    <main className="page-layout">
      <a
        className={buttonVariants({ size: "sm" })}
        href={
          estateId
            ? `/reports?estateId=${encodeURIComponent(estateId)}`
            : "/reports"
        }
      >
        Return to My Reports
      </a>
      <h1 className="my-4 font-semibold text-2xl">Report details</h1>
      {report.isPending ? <p role="status">Loading report…</p> : null}
      {report.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>Report not found or unavailable.</AlertDescription>
        </Alert>
      ) : null}
      {report.data ? (
        <ReportCard report={report.data}>
          <ReportDetails report={report.data}>
            {report.data.images?.map((image) =>
              image.id ? (
                <PrivateReportImage
                  imageId={image.id}
                  key={image.id}
                  reportId={reportId ?? ""}
                />
              ) : null
            )}
          </ReportDetails>
        </ReportCard>
      ) : null}
    </main>
  );
}
