import { Badge } from "@proj/ui/components/badge";
import { buttonVariants } from "@proj/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { useCallback } from "react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { SectionCard } from "@/components/page/section-card";
import { urgencyLabels } from "@/components/reports/urgency-labels";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type EstateReport,
  useEstateReport,
  useEstateReportAccess,
} from "@/lib/estate-reports";
import { pageHead } from "@/lib/page-title";
import { useRoutingAccess } from "@/lib/report-routing";
import {
  badgeVariantFor,
  reportUrgencyTone,
  workOrderStatusLabel,
  workOrderStatusTone,
} from "@/lib/status-tone";
import { useWorkOrderAccess } from "@/lib/work-orders";
import { DetailsCard } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/details-card";
import { DuplicateSection } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/duplicate-section/duplicate-section";
import { NextStepCard } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/next-step-card";
import { PrivateReportImage } from "@/routes/_auth/estates/$estateId/reports/$reportId/-components/private-report-image";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/reports/$reportId/"
)({
  component: EstateReportDetailPage,
  head: () => pageHead("Fault Report Details"),
});

/** A report status in plain words: "SUBMITTED" reads "Submitted". */
function ReportStatusBadge({ status }: { status: string }) {
  if (Object.hasOwn(workOrderStatusTone, status)) {
    const known = status as keyof typeof workOrderStatusTone;
    return (
      <Badge variant={badgeVariantFor(workOrderStatusTone[known])}>
        {workOrderStatusLabel[known]}
      </Badge>
    );
  }
  const words = status.toLowerCase().replaceAll("_", " ");
  return (
    <Badge variant="outline">
      {words.charAt(0).toUpperCase() + words.slice(1)}
    </Badge>
  );
}

function HeaderAction({
  estateId,
  report,
}: {
  estateId: string;
  report: EstateReport | undefined;
}) {
  const workOrders = useWorkOrderAccess(estateId);
  const routed = report?.routing?.workOrder;
  if (!report) {
    return null;
  }
  if (routed) {
    return workOrders.canView ? (
      <Link
        className={buttonVariants({ variant: "outline" })}
        params={{ estateId, workOrderId: routed.id }}
        to="/estates/$estateId/work-orders/$workOrderId"
      >
        View work order
      </Link>
    ) : null;
  }
  if (!workOrders.canCreate || report.duplicateOf) {
    return null;
  }
  return (
    <Link
      className={buttonVariants()}
      params={{ estateId }}
      search={{ sourceReportId: report.id }}
      to="/estates/$estateId/work-orders/new"
    >
      <Plus aria-hidden="true" />
      Create work order
    </Link>
  );
}

function WhatWasReported({
  estateId,
  report,
}: {
  estateId: string;
  report: EstateReport;
}) {
  return (
    <SectionCard contentClassName="grid gap-3" title="What was reported">
      <p className="wrap-anywhere whitespace-pre-wrap">{report.description}</p>
      {report.images.length === 0 ? (
        <p className="text-muted-foreground">No photos.</p>
      ) : (
        <div className="grid gap-3">
          {report.images.map((image) => (
            <PrivateReportImage
              estateId={estateId}
              imageId={image.id}
              key={image.id}
              reportId={report.id}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EstateReportDetailPage() {
  const { estateId, reportId } = Route.useParams();
  const access = useEstateReportAccess(estateId);
  const routingAccess = useRoutingAccess(estateId);
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
        actions={<HeaderAction estateId={estateId} report={loaded} />}
        breadcrumbs={[
          {
            label: "Fault reports",
            to: "/estates/$estateId/reports",
            params: { estateId },
          },
          { label: loaded?.title ?? "Fault report" },
        ]}
        icon={ClipboardList}
        meta={
          loaded?.createdAt
            ? `Reported ${new Date(loaded.createdAt).toLocaleString()}`
            : undefined
        }
        status={
          loaded ? (
            <div className="flex flex-wrap gap-2">
              <ReportStatusBadge status={loaded.status} />
              <Badge
                variant={badgeVariantFor(reportUrgencyTone[loaded.urgency])}
              >
                {urgencyLabels[loaded.urgency]} urgency
              </Badge>
              {loaded.isSafety ? (
                <Badge variant="destructive">Safety</Badge>
              ) : null}
            </div>
          ) : null
        }
        title={loaded?.title ?? "Fault report"}
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
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid min-w-0 gap-4">
            {loaded.routing ? (
              <NextStepCard
                estateId={estateId}
                reportId={reportId}
                routing={loaded.routing}
              />
            ) : null}
            <WhatWasReported estateId={estateId} report={loaded} />
          </div>
          <div className="grid min-w-0 gap-4">
            <DetailsCard
              canChangeType={
                routingAccess.canManage &&
                !!loaded.routing &&
                loaded.routing.state !== "CLASSIFYING"
              }
              canChangeUrgency={access.canChangeUrgency}
              canRelocate={access.canRelocate}
              estateId={estateId}
              reload={reload}
              report={loaded}
            />
            <DuplicateSection
              canReview={access.canReviewDuplicates}
              estateId={estateId}
              reload={reload}
              report={loaded}
            />
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}
