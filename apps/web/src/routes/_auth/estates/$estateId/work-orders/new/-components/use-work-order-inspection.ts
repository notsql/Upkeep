import { useCallback, useEffect, useState } from "react";
import {
  type InspectionAsset,
  useInspectionAsset,
  useInspectionSource,
} from "@/lib/inspections";

/** Source context only; form values and submission stay in useWorkOrderForm. */
export function useWorkOrderInspection(
  estateId: string,
  sourceInspectionId?: string
) {
  const source = useInspectionSource(estateId, sourceInspectionId ?? "");
  const record = sourceInspectionId ? source.data : undefined;
  const context = useInspectionAsset(estateId, record?.assetId ?? "");
  const [asset, setAsset] = useState<InspectionAsset>();
  const [confirmed, setConfirmed] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (!asset && record && context.data) {
      setAsset(context.data);
      setConfirmed(context.data.locationId === record.locationId);
    }
  }, [asset, record, context.data]);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      const latestSource = await source.refetch();
      if (latestSource.isError || !latestSource.data) {
        return false;
      }
      const latestContext = await context.refetch();
      if (latestContext.isError || !latestContext.data) {
        return false;
      }
      setAsset(latestContext.data);
      setConfirmed(false);
      return true;
    } finally {
      setReloading(false);
    }
  }, [source.refetch, context.refetch]);
  const confirmLocation = useCallback(() => setConfirmed(true), []);
  const active = !!(
    asset?.estateActive &&
    asset.assetActive &&
    asset.locationActive
  );
  const failed = source.isError || context.isError;
  const pending = !!sourceInspectionId && !(record && context.data && asset);

  return {
    record,
    asset,
    confirmed,
    active,
    failed,
    pending,
    reloading,
    reload,
    confirmLocation,
    blocked:
      pending ||
      failed ||
      reloading ||
      !active ||
      !confirmed ||
      record?.outcome !== "FAIL" ||
      !!record.workOrder,
  };
}
