import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { AssetLinkRecovery } from "./asset-link-recovery";
import { CurrentAsset } from "./current-asset";
import { DocumentAssetPicker } from "./document-asset-picker";
import type { DocumentAssetDialogState } from "./use-document-asset-dialog";

export function AssetLinkBody({
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
        <LoadingState label="Loading asset link…" rows={1} />
      ) : null}
      {state.association.isError ? (
        <ErrorState
          message="Unable to load asset association"
          onRetry={state.retry}
          retryLabel="Retry association"
        />
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
