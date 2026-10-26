import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Link } from "@tanstack/react-router";
import type { EstateDocument } from "@/lib/documents";
import { AssociationEditor } from "./association-editor";
import { AssociationHistory } from "./association-history";
import { AssociationRecovery } from "./association-recovery";
import {
  type AssociationDialogState,
  useDocumentWorkOrderDialog,
} from "./use-document-work-order-dialog";

function AssociationBody({
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
      <p role="alert">
        Unable to load document link.{" "}
        <Button onClick={retryAssociation} type="button" variant="outline">
          Retry document link
        </Button>
      </p>
    ) : (
      <p role="status">Loading document link…</p>
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
        <Alert variant="destructive">
          <AlertDescription>
            Unable to refresh the document link.{" "}
            <Button onClick={refresh} type="button" variant="outline">
              Retry document link
            </Button>
          </AlertDescription>
        </Alert>
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
export function DocumentWorkOrderDialog({
  estateId,
  document,
  onClose,
}: {
  estateId: string;
  document: EstateDocument;
  onClose: () => void;
}) {
  const state = useDocumentWorkOrderDialog({ estateId, document, onClose });
  return (
    <Dialog onOpenChange={state.close} open>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto overflow-x-hidden sm:max-w-2xl [&>*]:min-w-0"
        showCloseButton={!state.mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>Work-order link</DialogTitle>
          <DialogDescription className="break-words">
            {document.originalFilename}. Linking a document keeps the work-order
            status, completion outcome and costs unchanged.
          </DialogDescription>
        </DialogHeader>
        <AssociationBody estateId={estateId} state={state} />
        <Button
          disabled={state.mutation.isPending}
          onClick={onClose}
          type="button"
          variant="outline"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
