import type { DocumentAsset } from "@/lib/asset-documents";
import type { EstateDocument } from "@/lib/documents";
import { DocumentAssetDialog } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/document-asset-dialog";

export interface AssetDocumentSelection {
  association: DocumentAsset;
  document: EstateDocument;
}

export function AssetAssociationSelection({
  selection,
  estateId,
  userId,
  onClose,
}: {
  selection?: AssetDocumentSelection;
  estateId: string;
  userId?: string;
  onClose: () => void;
}) {
  if (!selection) {
    return null;
  }
  return (
    <DocumentAssetDialog
      document={selection.document}
      estateId={estateId}
      initialAssociation={selection.association}
      initialUnlink={!!selection.association.assetId}
      key={`${userId}:${estateId}:${selection.document.id}`}
      onClose={onClose}
    />
  );
}
