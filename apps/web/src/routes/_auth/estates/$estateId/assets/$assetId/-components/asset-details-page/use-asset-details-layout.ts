import { useCallback } from "react";
import { useAsset } from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { useInspectionAccess } from "@/lib/inspections";
import { useWorkOrderAccess } from "@/lib/work-orders";

export function useAssetDetailsLayout(estateId: string, assetId: string) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const inspections = useInspectionAccess(estateId);
  const retry = useCallback(() => asset.refetch(), [asset.refetch]);
  const workOrders = useWorkOrderAccess(estateId);
  const active = !(asset.data?.deactivatedAt || estate.data?.deactivatedAt);
  const canInspect = active && inspections.canCreate;
  // Sending crew or a contractor needs the same access as creating work orders.
  const canSend = active && workOrders.canCreate;
  return { active, asset, canInspect, canSend, retry };
}
