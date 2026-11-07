import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import type { useWorkOrderCompletionRevisions } from "@/lib/work-orders";

import { OutcomeRevision } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/outcome-revision";

export function OutcomeCorrections({
  revisions,
  onRetry,
}: {
  revisions: ReturnType<typeof useWorkOrderCompletionRevisions>;
  onRetry: () => unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Outcome corrections</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {revisions.isPending ? (
          <LoadingState label="Loading outcome corrections…" rows={2} />
        ) : null}
        {revisions.isError ? (
          <ErrorState
            message="Unable to load outcome corrections"
            onRetry={onRetry}
            retryLabel="Retry corrections"
          />
        ) : null}
        {!revisions.isError && revisions.data?.length === 0 ? (
          <EmptyState title="No corrections yet" />
        ) : null}
        {revisions.isError
          ? null
          : revisions.data?.map((revision) => (
              <OutcomeRevision key={revision.id} revision={revision} />
            ))}
      </CardContent>
    </Card>
  );
}
