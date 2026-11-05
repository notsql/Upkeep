import { useAssetDocumentAccess } from "@/lib/asset-documents";
import { AssetDocumentsContent } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-content";

export function AssetDocumentsSection({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useAssetDocumentAccess(estateId);
  if (!access.canRead) {
    return null;
  }
  return (
    <AssetDocumentsContent
      assetId={assetId}
      canWrite={access.canWrite}
      estateId={estateId}
      key={`${access.userId}:${estateId}:${assetId}`}
    />
  );
}
