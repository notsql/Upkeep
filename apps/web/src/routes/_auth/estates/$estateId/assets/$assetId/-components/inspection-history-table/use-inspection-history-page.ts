import { useCallback, useState } from "react";
import { useInspectionAsset, useInspectionResults } from "@/lib/inspections";
import { useWorkOrderAccess } from "@/lib/work-orders";

export function useInspectionHistoryPage(estateId: string, assetId: string) {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const history = useInspectionResults(estateId, assetId, cursors.at(-1));
  const asset = useInspectionAsset(estateId, assetId);
  const workAccess = useWorkOrderAccess(estateId);
  const active = !!(
    asset.data?.estateActive &&
    asset.data.assetActive &&
    asset.data.locationActive
  );
  const nextCursor = history.data?.nextCursor;
  const next = useCallback(() => {
    if (nextCursor && !history.isFetching) {
      setCursors((current) => [...current, nextCursor]);
    }
  }, [nextCursor, history.isFetching]);
  const previous = useCallback(() => {
    setCursors((current) =>
      current.length > 1 ? current.slice(0, -1) : current
    );
  }, []);
  const retry = useCallback(() => history.refetch(), [history.refetch]);

  return {
    active,
    asset,
    cursors,
    history,
    next,
    nextCursor,
    previous,
    retry,
    workAccess,
  };
}
