import { Button } from "@proj/ui/components/button";
import type { DocumentAssetDialogState } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/use-document-asset-dialog";

export function AssetLinkAction({
  state,
}: {
  state: DocumentAssetDialogState;
}) {
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
