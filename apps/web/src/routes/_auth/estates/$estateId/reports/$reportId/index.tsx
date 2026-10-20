import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { ReportCard } from "@/components/reports/report-card";
import { ReportDetails } from "@/components/reports/report-details";
import { useEstateReport, useEstateReportAccess } from "@/lib/estate-reports";
import { ChangeLocationDialog } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/change-location-dialog";
import { PrivateReportImage } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/private-report-image";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/reports/$reportId/"
)({
  component: EstateReportDetailPage,
  head: () => ({ meta: [{ title: "Fault Report Details" }] }),
});

function EstateReportDetailPage() {
  const { estateId, reportId } = Route.useParams();
  const access = useEstateReportAccess(estateId);
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
      <Link
        className={buttonVariants()}
        params={{ estateId }}
        search={{}}
        to="/estates/$estateId/reports"
      >
        Return to fault reports
      </Link>
      <h1 className="font-semibold text-2xl">Fault report details</h1>
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
    </main>
  );
}
