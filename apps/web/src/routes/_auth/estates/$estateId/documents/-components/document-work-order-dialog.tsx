import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import type { EstateDocument } from "@/lib/documents";
import { AssociationBody } from "./association-body";
import { useDocumentWorkOrderDialog } from "./use-document-work-order-dialog";

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
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-2xl [&>*]:min-w-0"
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
