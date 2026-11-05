import { useInspectionAccess } from "@/lib/inspections";
import { InspectionHistoryPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-page";

export function InspectionHistoryTable({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useInspectionAccess(estateId);
  if (!access.canView) {
    return null;
  }
  return (
    <InspectionHistoryPage
      assetId={assetId}
      estateId={estateId}
      key={`${access.userId}:${estateId}:${assetId}`}
    />
  );
}
