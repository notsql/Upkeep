import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { useEstateReport, useEstateReportAccess } from "@/lib/estate-reports";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { ChangeLocationDialog } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog";
import { PrivateReportImage } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/private-report-image";
import { RoutingCard } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/routing-card";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/reports/$reportId/"
)({
  component: EstateReportDetailPage,
  head: () => ({ meta: [{ title: "Fault Report Details" }] }),
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
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Fault report unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-4">
      <PageHeader
        actions={
          workOrders.canCreate && report.data && !report.isError ? (
            <Link
              className={buttonVariants()}
              params={{ estateId }}
              search={{ sourceReportId: reportId }}
              to="/estates/$estateId/work-orders/new"
            >
              Create work order
            </Link>
          ) : null
        }
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          {
            label: access.estateName ?? "Estate",
            to: access.canViewManagement ? "/estates/$estateId" : undefined,
            params: { estateId },
          },
          {
            label: "Fault reports",
            to: "/estates/$estateId/reports",
            params: { estateId },
          },
          { label: "Details" },
        ]}
        title="Fault report details"
      />
      {report.isPending ? <p role="status">Loading report…</p> : null}
      {report.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            Report not found or unavailable.{" "}
            <Button onClick={reload} variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
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
      {report.data?.routing && !report.isError ? (
        <RoutingCard
          estateId={estateId}
          reportId={reportId}
          routing={report.data.routing}
        />
      ) : null}
    </main>
  );
}
