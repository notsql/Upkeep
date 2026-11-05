import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { PageLayout } from "@/components/page-layout";
import { useWorkOrder, useWorkOrderAccess } from "@/lib/work-orders";
import { WorkOrderDocuments } from "./work-order-documents";
import { WorkOrderProgress } from "./work-order-progress";
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
      <p role="alert">
        Work order not found or unavailable.{" "}
        <Button onClick={retry} variant="outline">
          Retry
        </Button>
      </p>
    );
  }
  if (!order.data) {
    return <LoadingState label="Loading work order…" rows={2} />;
  }
  const { data } = order;
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        breadcrumbs={[
          {
            label: "Work orders",
            to: "/estates/$estateId/work-orders",
            params: { estateId },
          },
          { label: data.reference },
        ]}
        description={access.estateName}
        status={<Badge variant="outline">{data.status}</Badge>}
        title={data.reference}
      />
      {order.isError ? (
        <Alert className="rounded-xl">
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>
              Unable to refresh. Showing the last loaded work order; your draft
              is retained.
            </p>
            <Button onClick={retry} variant="outline">
              Retry loading
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="space-y-6">
          <p className="whitespace-pre-wrap">{data.description}</p>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt>Location</dt>
              <dd>{data.locationPath}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{data.category.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{data.priority}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{data.source.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Linked asset</dt>
              <dd>
                {data.assetId && access.canViewAssets ? (
                  <Link
                    className="text-primary underline underline-offset-4 focus-visible:rounded-sm"
                    params={{ estateId, assetId: data.assetId }}
                    to="/estates/$estateId/assets/$assetId"
                  >
                    {data.assetReference}
                  </Link>
                ) : (
                  (data.assetReference ?? "No linked asset")
                )}
              </dd>
            </div>
            {data.sourceReportId ? (
              <div>
                <dt>Resident report</dt>
                <dd>
                  {access.canReadReports ? (
                    <Link
                      className="text-primary underline underline-offset-4 focus-visible:rounded-sm"
                      params={{ estateId, reportId: data.sourceReportId }}
                      to="/estates/$estateId/reports/$reportId"
                    >
                      View source report
                    </Link>
                  ) : (
                    "Resident report linked"
                  )}
                </dd>
              </div>
            ) : null}
            {data.sourceReference ? (
              <div>
                <dt>Source reference or explanation</dt>
                <dd className="whitespace-pre-wrap">{data.sourceReference}</dd>
              </div>
            ) : null}
          </dl>
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
            <p>
              Created by{" "}
              <span className="text-foreground font-medium">
                {data.createdByName?.trim() || "Name unavailable"}
              </span>
            </p>
            <time dateTime={data.createdAt}>
              {new Date(data.createdAt).toLocaleString()}
            </time>
          </div>
        </CardContent>
      </Card>
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

function isTransientFailure(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (
    !(
      error instanceof Error &&
      "status" in error &&
      typeof error.status === "number"
    )
  ) {
    return false;
  }
  return error.status === 0 || error.status >= 500;
}
