import { AssetDocumentsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-section/asset-documents-section";
import { AssetMaintenance } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance";
import { InspectionHistoryTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-table";

/**
 * The asset's paper trail on one page: inspections, maintenance, documents.
 * Each section gates itself on the viewer's access.
 */
export function AssetRecords({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  return (
    <>
      <InspectionHistoryTable
        assetId={assetId}
        estateId={estateId}
        offerCreate
      />
      <AssetMaintenance assetId={assetId} estateId={estateId} />
      <AssetDocumentsSection assetId={assetId} estateId={estateId} />
    </>
  );
}
