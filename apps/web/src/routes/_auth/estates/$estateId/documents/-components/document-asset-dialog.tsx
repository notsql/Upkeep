import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Link } from "@tanstack/react-router";
import type { DocumentAsset } from "@/lib/asset-documents";
import type { EstateDocument } from "@/lib/documents";
import { DocumentAssetPicker } from "./document-asset-picker";
import {
  type DocumentAssetDialogState,
  useDocumentAssetDialog,
} from "./use-document-asset-dialog";

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
        className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto overflow-x-hidden sm:max-w-3xl [&>*]:min-w-0"
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

function AssetLinkAction({ state }: { state: DocumentAssetDialogState }) {
  if (state.latest?.assetId && !state.removing) {
    return (
      <Button onClick={state.unlink} type="button" variant="outline">
        Unlink
      </Button>
    );
  }
  const actionLabel = state.removing ? "Unlink" : "Save link";
  const buttonLabel = state.mutation.isPending ? "Saving…" : actionLabel;
  return (
    <Button
      disabled={state.saveDisabled}
      onClick={state.save}
      type="button"
      variant={state.removing ? "destructive" : "default"}
    >
      {buttonLabel}
    </Button>
  );
}

function AssetLinkBody({
  estateId,
  state,
}: {
  estateId: string;
  state: DocumentAssetDialogState;
}) {
  if (!state.access.canRead || state.denied) {
    return <p role="alert">The asset document link is unavailable.</p>;
  }
  return (
    <>
      {state.association.isPending ? (
        <p role="status">Loading asset link…</p>
      ) : null}
      {state.association.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Unable to load asset association.{" "}
            <Button onClick={state.retry} type="button" variant="outline">
              Retry association
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {state.removing && state.draft ? (
        <div className="space-y-2">
          <p>
            Unlink from {state.draft.association.assetReference} —{" "}
            {state.draft.association.assetName}?
          </p>
          <p>The file is retained. Any work-order link is kept.</p>
        </div>
      ) : (
        <CurrentAsset estateId={estateId} state={state} />
      )}
      {state.access.canWrite &&
      !state.latest?.assetId &&
      !state.removing &&
      !state.association.isError ? (
        <DocumentAssetPicker
          disabled={!state.latest || state.mutation.isPending || state.blocked}
          estateId={estateId}
          onSelect={state.select}
          selected={state.draft?.selected}
        />
      ) : null}
      <AssetLinkRecovery state={state} />
    </>
  );
}

function CurrentAsset({
  estateId,
  state,
}: {
  estateId: string;
  state: DocumentAssetDialogState;
}) {
  if (!state.latest) {
    return null;
  }
  if (!state.latest.assetId) {
    return <p>Not linked to an asset.</p>;
  }
  return (
    <p>
      Linked asset:{" "}
      <Link
        className="underline"
        params={{ estateId, assetId: state.latest.assetId }}
        to="/estates/$estateId/assets/$assetId"
      >
        {state.latest.assetReference} — {state.latest.assetName}
      </Link>
    </p>
  );
}

function AssetLinkRecovery({ state }: { state: DocumentAssetDialogState }) {
  return (
    <>
      {state.mutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-2">
            <p>{state.mutation.error.message}</p>
            {state.blocked ? (
              <>
                <p>Refresh to check the saved association before retrying.</p>
                <Button
                  disabled={state.refreshing}
                  onClick={state.refresh}
                  type="button"
                  variant="outline"
                >
                  Refresh association
                </Button>
              </>
            ) : (
              <p>Correct the selection and save again.</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {state.refreshError ? <p role="alert">{state.refreshError}</p> : null}
      {state.reviewing ? (
        <Alert>
          <AlertDescription>
            <p>Review the current asset link before continuing.</p>
            <Button onClick={state.review} type="button" variant="outline">
              I reviewed the updated link
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
