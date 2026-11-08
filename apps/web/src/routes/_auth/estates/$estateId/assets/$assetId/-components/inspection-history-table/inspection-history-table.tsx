import { useInspectionAccess } from "@/lib/inspections";
import { InspectionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-page";

export function InspectionHistoryTable({
  estateId,
  assetId,
  offerCreate = false,
}: {
  estateId: string;
  assetId: string;
  /** Show "New inspection" in the section header to viewers who may file one. */
  offerCreate?: boolean;
}) {
  const access = useInspectionAccess(estateId);
  if (!access.canView) {
    return null;
  }
  return (
    <InspectionHistoryPage
      assetId={assetId}
      canCreate={offerCreate && access.canCreate}
      estateId={estateId}
      key={`${access.userId}:${estateId}:${assetId}`}
    />
  );
}
