import { Button } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { type DocumentAsset, useDocumentAsset } from "@/lib/asset-documents";
import type { EstateDocument } from "@/lib/documents";

export function DocumentAssets({
  estateId,
  document,
  canWrite,
  onManage,
}: {
  estateId: string;
  document: EstateDocument;
  canWrite: boolean;
  onManage: (document: EstateDocument, association: DocumentAsset) => void;
}) {
  const association = useDocumentAsset(estateId, document.id);
  const manage = useCallback(() => {
    if (association.data) {
      onManage(document, association.data);
    }
  }, [document, association.data, onManage]);
  const retry = useCallback(() => association.refetch(), [association.refetch]);

  if (association.isError) {
    return (
      <div role="alert">
        Unable to load asset link.{" "}
        <Button
          aria-label={`Retry asset link for ${document.originalFilename}`}
          onClick={retry}
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  if (!association.data) {
    return <span role="status">Loading asset link…</span>;
  }
  if (association.data.assetId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="underline"
          params={{ estateId, assetId: association.data.assetId }}
          to="/estates/$estateId/assets/$assetId"
        >
          {association.data.assetReference} — {association.data.assetName}
        </Link>
        {canWrite ? (
          <Button
            aria-label={`Unlink for ${document.originalFilename}`}
            onClick={manage}
            variant="outline"
          >
            Unlink
          </Button>
        ) : null}
      </div>
    );
  }
  if (!canWrite) {
    return <span>—</span>;
  }
  return (
    <Button
      aria-label={`Associate Asset for ${document.originalFilename}`}
      onClick={manage}
      variant="outline"
    >
      Associate Asset
    </Button>
  );
}
