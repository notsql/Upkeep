import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Wrench } from "lucide-react";
import { useCallback } from "react";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { WorkOrderStatusBadge } from "@/components/work-orders/work-order-status-badge";
import { useWorkOrder, useWorkOrderAccess } from "@/lib/work-orders";
import { isTransientFailure } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/is-transient-failure";
import { WorkOrderDetailSummary } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-detail-summary";
import { WorkOrderDocuments } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-documents";
import { WorkOrderProgress } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-progress";
export function WorkOrderDetailPage({
  estateId,
  workOrderId,
}: {
  estateId: string;
  workOrderId: string;
}) {
  const access = useWorkOrderAccess(estateId);
  const order = useWorkOrder(estateId, workOrderId);
  const refresh = useCallback(
    () => order.refetch({ throwOnError: true }),
    [order.refetch]
  );
  const retry = useCallback(() => order.refetch(), [order.refetch]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Work order unavailable.</p>;
  }
  if (order.isError && !(order.data && isTransientFailure(order.error))) {
    return (
      <PageLayout>
        <ErrorState
          message="Work order not found or unavailable"
          onRetry={retry}
        />
      </PageLayout>
    );
  }
  if (!order.data) {
    return <LoadingState label="Loading work order…" rows={2} />;
  }
  const { data } = order;
  return (
    <PageLayout className="space-y-6">
      <DetailPageHeader
        breadcrumbs={[
          {
            label: "Work orders",
            to: "/estates/$estateId/work-orders",
            params: { estateId },
          },
          { label: data.reference },
        ]}
        icon={Wrench}
        meta={`Opened ${new Date(data.createdAt).toLocaleDateString()}`}
        status={<WorkOrderStatusBadge status={data.status} />}
        title={data.reference}
      />
      {order.isError ? (
        <Alert className="rounded-xl" variant="warning">
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>
              Couldn't refresh. Showing the last loaded work order; your draft
              is retained.
            </p>
            <Button onClick={retry} variant="outline">
              Retry loading
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <WorkOrderDetailSummary
        canReadReports={access.canReadReports}
        canViewAssets={access.canViewAssets}
        canViewReadings={access.canViewReadings}
        data={data}
        estateId={estateId}
      />
      {access.canViewDocuments ? (
        <WorkOrderDocuments
          estateId={estateId}
          key={`${access.userId}:${estateId}:${workOrderId}`}
          workOrderId={workOrderId}
        />
      ) : null}
      <WorkOrderProgress
        canUpdate={access.canUpdate}
        estateId={estateId}
        key={data.id}
        onRefresh={refresh}
        order={data}
      />
    </PageLayout>
  );
}
