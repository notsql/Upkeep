import type { components } from "@proj/api/schema";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAsset, useDeactivateAsset } from "@/lib/assets";

export function useAssetDetailsTab(estateId: string, assetId: string) {
  const asset = useAsset(estateId, assetId);
  const deactivate = useDeactivateAsset(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const confirm = useCallback(
    async (request: components["schemas"]["DeactivateAssetRequest"]) => {
      await deactivate.mutateAsync(request);
      setConfirming(false);
      toast.success("Asset retired. Its record has been preserved.");
    },
    [deactivate.mutateAsync]
  );
  return { asset, closeConfirmation, confirm, confirming, openConfirmation };
}
