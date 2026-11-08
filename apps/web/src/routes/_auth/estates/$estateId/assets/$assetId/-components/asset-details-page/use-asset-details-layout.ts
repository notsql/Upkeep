import { useCallback } from "react";
import { useAsset } from "@/lib/assets";
import { useEstate } from "@/lib/estates";
import { useInspectionAccess } from "@/lib/inspections";

export function useAssetDetailsLayout(estateId: string, assetId: string) {
  const estate = useEstate(estateId);
  const asset = useAsset(estateId, assetId);
  const inspections = useInspectionAccess(estateId);
  const retry = useCallback(() => asset.refetch(), [asset.refetch]);
  const canInspect =
    !(asset.data?.deactivatedAt || estate.data?.deactivatedAt) &&
    inspections.canCreate;
  return { asset, canInspect, retry };
}
