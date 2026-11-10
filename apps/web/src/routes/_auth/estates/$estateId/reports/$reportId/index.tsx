import { buttonVariants } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { useCallback } from "react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { ReportUrgencyBadges } from "@/components/reports/report-urgency-badges";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useEstateReport, useEstateReportAccess } from "@/lib/estate-reports";
import { pageHead } from "@/lib/page-title";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { ChangeLocationDialog } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog/change-location-dialog";
import { ChangeUrgencyDialog } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-urgency-dialog/change-urgency-dialog";
import { DuplicateSection } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/duplicate-section/duplicate-section";
import { LatestUrgencyChange } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/latest-urgency-change";
import { PrivateReportImage } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/private-report-image";
import { RoutingCard } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/routing-card";

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
  const loaded = report.isError ? undefined : report.data;
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
        icon={ClipboardList}
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
      {loaded ? (
        <ReportCard
          locationAction={
            access.canRelocate || access.canChangeUrgency ? (
              <div className="flex flex-wrap items-center gap-3">
                {access.canRelocate ? (
                  <ChangeLocationDialog
                    estateId={estateId}
                    reload={reload}
                    report={loaded}
                  />
                ) : null}
                {access.canChangeUrgency ? (
                  <ChangeUrgencyDialog
                    estateId={estateId}
                    reload={reload}
                    report={loaded}
                  />
                ) : null}
              </div>
            ) : null
          }
          report={loaded}
          showUpdated
          urgency={
            <ReportUrgencyBadges
              isSafety={loaded.isSafety}
              urgency={loaded.urgency}
            />
          }
        >
          <LatestUrgencyChange change={loaded.lastUrgencyChange} />
          <ReportDetails report={loaded}>
            {loaded.images.map((image) => (
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
      {loaded ? (
        <DuplicateSection
          canReview={access.canReviewDuplicates}
          estateId={estateId}
          reload={reload}
          report={loaded}
        />
      ) : null}
      {loaded?.routing ? (
        <RoutingCard
          estateId={estateId}
          reportId={reportId}
          routing={loaded.routing}
        />
      ) : null}
    </PageLayout>
  );
}
