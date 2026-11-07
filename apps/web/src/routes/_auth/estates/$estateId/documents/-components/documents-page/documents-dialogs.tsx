import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import type { EstateDocument, useDeleteDocument } from "@/lib/documents";
import {
  AssetAssociationSelection,
  type AssetDocumentSelection,
} from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/asset-association-selection";
import { DocumentWorkOrderDialog } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-work-order-dialog/document-work-order-dialog";

export function DocumentsDialogs({
  assetSelection,
  associationDocument,
  deletion,
  estateId,
  onCloseAsset,
  onCloseAssociation,
  onCloseDeletion,
  onRemove,
  selected,
  userId,
}: {
  assetSelection: AssetDocumentSelection | undefined;
  associationDocument: EstateDocument | undefined;
  deletion: ReturnType<typeof useDeleteDocument>;
  estateId: string;
  onCloseAsset: () => void;
  onCloseAssociation: () => void;
  onCloseDeletion: () => void;
  onRemove: () => void;
  selected: EstateDocument | undefined;
  userId: string | undefined;
}) {
  return (
    <>
      {associationDocument ? (
        <DocumentWorkOrderDialog
          document={associationDocument}
          estateId={estateId}
          key={`${estateId}:${associationDocument.id}`}
          onClose={onCloseAssociation}
        />
      ) : null}
      <AssetAssociationSelection
        estateId={estateId}
        onClose={onCloseAsset}
        selection={assetSelection}
        userId={userId}
      />
      <ConfirmDialog
        confirmLabel="Delete file"
        description={`${selected?.originalFilename ?? ""} will be removed from the estate documents. This cannot be undone.`}
        error={deletion.isError ? deletion.error.message : undefined}
        onCancel={onCloseDeletion}
        onConfirm={onRemove}
        open={!!selected}
        pending={deletion.isPending}
        pendingLabel="Deleting…"
        title="Delete file"
      />
    </>
  );
}
