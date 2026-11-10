import { useAsset } from "@/lib/assets";
import { useAssetFailureRisk } from "@/lib/failure-risk";
import { formatDate } from "@/lib/format";
import type { WorkOrderAssetOption } from "@/lib/work-orders";

/** Why the form was opened from a warning; only end of life fills it in. */
export type WorkOrderReason = "END_OF_LIFE";

export interface WorkOrderPrefill {
  asset: WorkOrderAssetOption;
  description: string;
  sourceReference: string;
}

/**
 * What "Send a contractor" fills in for equipment at the end of its life, once
 * the equipment and its forecast have loaded. Nothing is saved until the
 * manager does.
 */
export function useWorkOrderPrefill(
  estateId: string,
  assetId: string | undefined,
  reason: WorkOrderReason | undefined
): WorkOrderPrefill | undefined {
  const enabled = Boolean(assetId && reason);
  const asset = useAsset(estateId, assetId ?? "", enabled);
  const risk = useAssetFailureRisk(estateId, assetId ?? "", enabled);
  if (!(enabled && asset.data && risk.data)) {
    return;
  }
  const { id, reference, name, locationId, locationPath } = asset.data;
  const end = risk.data.expectedEndOfLife;
  return {
    asset: { id, reference, name, locationId, locationPath },
    sourceReference: end
      ? `Reached end of life (expected ${formatDate(end)})`
      : "Reached end of life",
    description: `Replace ${name}. It has reached the end of its expected life.`,
  };
}
