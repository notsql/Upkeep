import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { AssociationEditor } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/association-editor";
import { AssociationHistory } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/association-history";
import { AssociationRecovery } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/association-recovery";
import type { AssociationDialogState } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/use-document-work-order-dialog";

export function AssociationBody({
  estateId,
  state,
}: {
  estateId: string;
  state: AssociationDialogState;
}) {
  const {
    access,
    denied,
    latest,
    association,
    draft,
    change,
    remove,
    refresh,
    retryAssociation,
  } = state;
  if (!access.canRead || denied) {
    return (
      <Alert variant="destructive">
        <AlertDescription>The document link is unavailable.</AlertDescription>
      </Alert>
    );
  }
  if (!latest) {
    return association.isError ? (
      <ErrorState
        message="Couldn't load document link. Try again."
        onRetry={retryAssociation}
        retryLabel="Retry document link"
      />
    ) : (
      <LoadingState label="Loading document link…" rows={1} />
    );
  }
  return (
    <>
      <section aria-label="Current work-order link" className="space-y-2">
        <h3 className="font-medium">Current work order</h3>
        {latest.workOrderId ? (
          <Link
            className="text-primary underline underline-offset-4"
            params={{ estateId, workOrderId: latest.workOrderId }}
            to="/estates/$estateId/work-orders/$workOrderId"
          >
            {latest.workOrderReference}
          </Link>
        ) : (
          <p>Not linked to a work order.</p>
        )}
        {latest.changedAt ? (
          <p className="text-muted-foreground text-sm">
            {latest.changedByName ?? "Name unavailable"} ·{" "}
            {new Date(latest.changedAt).toLocaleString()}
          </p>
        ) : null}
      </section>
      {association.isError ? (
        <ErrorState
          message="Couldn't refresh the document link. Try again."
          onRetry={refresh}
          retryLabel="Retry document link"
        />
      ) : null}
      {access.canWrite && latest.workOrderId && !draft ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={change} type="button" variant="outline">
            Change work order
          </Button>
          <Button onClick={remove} type="button" variant="outline">
            Remove link
          </Button>
        </div>
      ) : null}
      <AssociationEditor estateId={estateId} state={state} />
      <AssociationRecovery state={state} />
      <AssociationHistory state={state} />
    </>
  );
}
