import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import type { DocumentAsset } from "@/lib/asset-documents";
import type { EstateDocument } from "@/lib/documents";
import { AssetLinkAction } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/asset-link-action";

import { AssetLinkBody } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/asset-link-body";
import { useDocumentAssetDialog } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/use-document-asset-dialog";

export function DocumentAssetDialog({
  estateId,
  document,
  initialUnlink = false,
  initialAssociation,
  onClose,
}: {
  estateId: string;
  document: EstateDocument;
  initialUnlink?: boolean;
  initialAssociation?: DocumentAsset;
  onClose: () => void;
}) {
  const state = useDocumentAssetDialog({
    estateId,
    document,
    initialUnlink,
    initialAssociation,
    onClose,
  });
  return (
    <Dialog onOpenChange={state.close} open>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-3xl [&>*]:min-w-0"
        showCloseButton={!state.mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>
            {state.removing ? "Unlink document" : "Associate Asset"}
          </DialogTitle>
          <DialogDescription className="break-words">
            {document.originalFilename}
          </DialogDescription>
        </DialogHeader>
        <AssetLinkBody estateId={estateId} state={state} />
        <DialogFooter>
          <Button
            disabled={state.mutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {state.access.canWrite && !state.denied ? (
            <AssetLinkAction state={state} />
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
