import { Alert, AlertDescription, AlertTitle } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Separator } from "@proj/ui/components/separator";
import { CircleCheck } from "lucide-react";
import { useCallback, useState } from "react";
import { PageSection } from "@/components/page/section-card";
import { CompletionOutcome } from "@/components/work-orders/work-order-completion";
import {
  useChangeWorkOrderStatus,
  useWorkOrderCompletionRevisions,
  useWorkOrderStatusHistory,
  type WorkOrder,
} from "@/lib/work-orders";
import { CompletionDialog } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/completion-dialog";
import { OutcomeCorrections } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/outcome-corrections";
import { StatusHistory } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/status-history";

export function WorkOrderProgress({
  estateId,
  order,
  canUpdate,
  onRefresh,
}: {
  estateId: string;
  order: WorkOrder;
  canUpdate: boolean;
  onRefresh: () => unknown;
}) {
  const change = useChangeWorkOrderStatus(estateId, order.id);
  const history = useWorkOrderStatusHistory(estateId, order.id);
  const revisions = useWorkOrderCompletionRevisions(
    estateId,
    order.id,
    !!order.completion
  );
  const retryRevisions = useCallback(
    () => revisions.refetch(),
    [revisions.refetch]
  );
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const openCompletion = useCallback(() => setCompleting(true), []);
  const closeCompletion = useCallback(() => setCompleting(false), []);
  const retryHistory = useCallback(() => history.refetch(), [history.refetch]);
  const refreshOrder = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        onRefresh(),
        history.refetch({ throwOnError: true }),
        ...(order.completion
          ? [revisions.refetch({ throwOnError: true })]
          : []),
      ]);
      setError(undefined);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, history.refetch, order.completion, revisions.refetch]);
  const recover = useCallback(async () => {
    try {
      await refreshOrder();
    } catch {
      setError("Couldn't refresh the work order and history. Try again.");
    }
  }, [refreshOrder]);
  const start = useCallback(async () => {
    setError(undefined);
    try {
      await change.mutateAsync({
        targetStatus: "IN_PROGRESS",
        expectedVersion: order.version,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn't start work. Try again."
      );
    }
  }, [change.mutateAsync, order.version]);
  // Owners, Managers and the Crew member given the job may start and finish it.
  const { canProgress } = order;
  return (
    <>
      {canProgress ? (
        <div className="flex flex-wrap gap-2">
          {order.status === "OPEN" || order.status === "ASSIGNED" ? (
            <Button disabled={change.isPending} onClick={start}>
              Start job
            </Button>
          ) : null}
          {order.status === "IN_PROGRESS" ? (
            <Button onClick={openCompletion}>Mark as done</Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <Alert className="rounded-xl" variant="warning">
          <AlertTitle>Review the latest work order</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <p>{error}</p>
            <Button disabled={refreshing} onClick={recover} variant="outline">
              {refreshing ? "Refreshing…" : "Refresh work order"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {order.completion ? (
        <>
          <PageSection
            actions={
              canUpdate ? (
                <Button onClick={openCompletion} variant="outline">
                  Edit outcome
                </Button>
              ) : null
            }
            icon={CircleCheck}
            title="Completion outcome"
          >
            <CompletionOutcome completion={order.completion} />
          </PageSection>
          <Separator />
        </>
      ) : null}
      <StatusHistory history={history} onRetry={retryHistory} />
      {order.completion ? (
        <>
          <Separator />
          <OutcomeCorrections onRetry={retryRevisions} revisions={revisions} />
        </>
      ) : null}
      {completing && (canUpdate || canProgress) ? (
        <CompletionDialog
          estateId={estateId}
          onClose={closeCompletion}
          onRefresh={refreshOrder}
          order={order}
        />
      ) : null}
    </>
  );
}
