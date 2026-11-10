import { DispatchAction } from "@/components/dispatch/dispatch-action";
import { useEstateFailureRisk } from "@/lib/failure-risk";
import type { InspectionCheck } from "@/lib/inspection-list";

/**
 * "Send a contractor" on a predicted check whose equipment has reached the end
 * of its life: it needs replacing, not inspecting. Mounted only for senders.
 */
export function EndOfLifeAction({
  check,
  estateId,
}: {
  check: InspectionCheck;
  estateId: string;
}) {
  // One estate-wide query, shared by every row.
  const risk = useEstateFailureRisk(estateId).data?.find(
    (item) => item.assetId === check.assetId
  );
  if (!risk?.flagReasons.includes("END_OF_LIFE")) {
    return null;
  }
  return (
    <DispatchAction
      assetId={check.assetId}
      assetName={check.assetName}
      canSend
      estateId={estateId}
      route="CONTRACTOR"
    />
  );
}
