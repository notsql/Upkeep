import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { DetailPageHeader } from "@/components/page-header";
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
  const retry = useCallback(() => {
    report.refetch();
  }, [report]);
  return (
    <PageLayout>
      <DetailPageHeader
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
        <ErrorState message="Report not found or unavailable" onRetry={retry} />
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
