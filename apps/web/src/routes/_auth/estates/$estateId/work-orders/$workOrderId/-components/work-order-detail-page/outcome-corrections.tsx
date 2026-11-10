import { FilePenLine } from "lucide-react";
import { PageSection } from "@/components/page/section-card";
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
    <PageSection icon={FilePenLine} title="Outcome corrections">
      {revisions.isPending ? (
        <LoadingState label="Loading outcome corrections…" rows={2} />
      ) : null}
      {revisions.isError ? (
        <ErrorState
          message="Couldn't load the change history. Try again."
          onRetry={onRetry}
          retryLabel="Retry corrections"
        />
      ) : null}
      {!revisions.isError && revisions.data?.length === 0 ? (
        <EmptyState icon={FilePenLine} title="No corrections yet" />
      ) : null}
      {revisions.isError
        ? null
        : revisions.data?.map((revision) => (
            <OutcomeRevision key={revision.id} revision={revision} />
          ))}
    </PageSection>
  );
}
