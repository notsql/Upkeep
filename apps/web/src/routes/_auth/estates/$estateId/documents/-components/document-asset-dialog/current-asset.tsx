import { Link } from "@tanstack/react-router";
import type { DocumentAssetDialogState } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/use-document-asset-dialog";

export function CurrentAsset({
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
