import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RankedDevice, rankDevices } from "@/lib/asset-monitoring";
import { useEstateDevices } from "@/lib/devices";
import { useAllFlatlineReview } from "@/lib/flatlined-sensors";
import { flattenLocations, useLocations } from "@/lib/locations";

interface FrozenOrder {
  ids: string[];
  /** Which sources had failed when the order was computed. */
  outcome: string;
}

/**
 * Joins the estate devices (when `withDevices`) with every flatline review
 * page. The rank is computed once both sources settle and then held, so
 * polling never reshuffles rows; it is recomputed only after the user retries
 * a failed source and that source's outcome changes.
 */
export function useAllDevicesPage(estateId: string, withDevices: boolean) {
  const devices = useEstateDevices(estateId, withDevices);
  const review = useAllFlatlineReview(estateId, "ALL");
  const locations = useLocations(estateId, true, withDevices);
  const devicesSettled = !(withDevices && devices.isPending);
  const settled = devicesSettled && !review.isPending;
  const deviceList = withDevices ? (devices.data ?? null) : null;
  const latest = useMemo(
    () => (settled ? rankDevices(deviceList, review.sensors) : null),
    [settled, deviceList, review.sensors]
  );
  const outcome = `${Boolean(devices.error)}:${Boolean(review.error)}`;
  const retried = useRef(false);
  const [frozen, setFrozen] = useState<FrozenOrder | null>(null);
  useEffect(() => {
    if (!latest) {
      return;
    }
    if (frozen && (frozen.outcome === outcome || !retried.current)) {
      return;
    }
    retried.current = false;
    setFrozen({ ids: latest.map((row) => row.deviceId), outcome });
  }, [frozen, latest, outcome]);
  const rows = useMemo((): RankedDevice[] | null => {
    if (!(latest && frozen)) {
      return null;
    }
    // Devices that appeared since the rank was fixed go last, in rank order.
    const position = new Map(frozen.ids.map((id, index) => [id, index]));
    const at = (row: RankedDevice) =>
      position.get(row.deviceId) ?? frozen.ids.length;
    return [...latest].sort((a, b) => at(a) - at(b));
  }, [frozen, latest]);
  const paths = useMemo(
    () =>
      new Map(
        flattenLocations(locations.data ?? []).map((node) => [
          node.id,
          node.path.join(" › "),
        ])
      ),
    [locations.data]
  );
  const locationFor = useCallback(
    (row: RankedDevice) =>
      row.locationPath ??
      (row.locationId ? paths.get(row.locationId) : undefined),
    [paths]
  );
  const { refetch: refetchDevices } = devices;
  const { refetch: refetchReview } = review;
  const retryDevices = useCallback(() => {
    retried.current = true;
    refetchDevices();
  }, [refetchDevices]);
  const retryReview = useCallback(() => {
    retried.current = true;
    refetchReview();
  }, [refetchReview]);
  return {
    canManage: withDevices && review.canManage,
    devicesError: withDevices ? devices.error : null,
    locationFor,
    retryDevices,
    retryReview,
    reviewError: review.error,
    rows,
    showStatus: Boolean(deviceList),
  };
}
