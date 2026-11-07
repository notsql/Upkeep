import { buttonVariants } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback } from "react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateReport, useEstateReportAccess } from "@/lib/estate-reports";
import { pageHead } from "@/lib/page-title";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { ChangeLocationDialog } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog/change-location-dialog";
import { DuplicateSection } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/duplicate-section/duplicate-section";
import { PrivateReportImage } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/private-report-image";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/reports/$reportId/"
)({
  component: EstateReportDetailPage,
  head: () => pageHead("Fault Report Details"),
});

function EstateReportDetailPage() {
  const { estateId, reportId } = Route.useParams();
  const access = useEstateReportAccess(estateId);
  const workOrders = useWorkOrderAccess(estateId);
  const report = useEstateReport(estateId, reportId);
  const reload = useCallback(async () => {
    const result = await report.refetch();
    return result.isError ? undefined : result.data;
  }, [report.refetch]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Fault report unavailable.</p>;
  }
  return (
    <PageLayout className="space-y-4">
      <DetailPageHeader
        actions={
          workOrders.canCreate &&
          report.data &&
          !report.isError &&
          !report.data.duplicateOf ? (
            <Link
              className={buttonVariants()}
              params={{ estateId }}
              search={{ sourceReportId: reportId }}
              to="/estates/$estateId/work-orders/new"
            >
              <Plus aria-hidden="true" />
              Create work order
            </Link>
          ) : null
        }
        breadcrumbs={[
          {
            label: "Fault reports",
            to: "/estates/$estateId/reports",
            params: { estateId },
          },
          { label: report.data?.title ?? "Fault report" },
        ]}
        title="Fault report details"
      />
      {report.isPending ? (
        <LoadingState label="Loading report…" rows={2} />
      ) : null}
      {report.isError ? (
        <ErrorState
          message="Report not found or unavailable"
          onRetry={reload}
        />
      ) : null}
      {report.data && !report.isError ? (
        <ReportCard
          locationAction={
            access.canRelocate ? (
              <ChangeLocationDialog
                estateId={estateId}
                reload={reload}
                report={report.data}
              />
            ) : null
          }
          report={report.data}
          showUpdated
        >
          <ReportDetails report={report.data}>
            {report.data.images.map((image) => (
              <PrivateReportImage
                estateId={estateId}
                imageId={image.id}
                key={image.id}
                reportId={reportId}
              />
            ))}
          </ReportDetails>
        </ReportCard>
      ) : null}
      {report.data && !report.isError ? (
        <DuplicateSection
          canReview={access.canReviewDuplicates}
          estateId={estateId}
          reload={reload}
          report={report.data}
        />
      ) : null}
    </PageLayout>
  );
}
