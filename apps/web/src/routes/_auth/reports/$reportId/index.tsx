import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { pageHead } from "@/lib/page-title";
import { useReport } from "@/lib/reports";
import { PrivateReportImage } from "./-components/private-report-image";

export const Route = createFileRoute("/_auth/reports/$reportId/")({
  validateSearch: (search: Record<string, unknown>): { estateId?: string } => ({
    ...(typeof search.estateId === "string" && search.estateId
      ? { estateId: search.estateId }
      : {}),
  }),
  component: ReportDetailPage,
  head: () => pageHead("Report details"),
});

function ReportDetailPage() {
  const { reportId } = useParams({ strict: false });
  const { estateId } = useSearch({ strict: false });
  const report = useReport(reportId ?? "");
  return (
    <PageLayout>
      <PageHeader
        breadcrumbs={[
          {
            label: "My reports",
            to: "/reports",
            search: estateId ? { estateId } : undefined,
          },
          { label: report.data?.title ?? "Report" },
        ]}
        title="Report details"
      />
      {report.isPending ? (
        <LoadingState label="Loading report…" rows={1} />
      ) : null}
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
    </PageLayout>
  );
}
