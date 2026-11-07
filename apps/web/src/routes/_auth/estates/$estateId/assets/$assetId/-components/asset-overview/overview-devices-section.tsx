import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { RadioTower } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { SectionCard } from "@/components/page/section-card";
import { PauseSensorDialog } from "@/components/sensors/pause-sensor-dialog";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useDevices } from "@/lib/devices";
import {
  type MonitoredSensor,
  useAllFlatlineReview,
} from "@/lib/flatlined-sensors";
import { OverviewDeviceItem } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/overview-device-item";

/** The asset's devices with their flatline state, each source failing on its own. */
export function OverviewDevicesSection({
  assetId,
  canRegister,
  estateId,
}: {
  assetId: string;
  canRegister: boolean;
  estateId: string;
}) {
  const devices = useDevices(estateId, assetId);
  const review = useAllFlatlineReview(estateId, "ALL");
  const [selected, setSelected] = useState<MonitoredSensor>();
  const byDevice = useMemo(() => {
    const map = new Map<string, MonitoredSensor[]>();
    for (const sensor of review.sensors) {
      if (sensor.assetId === assetId) {
        map.set(sensor.deviceId, [...(map.get(sensor.deviceId) ?? []), sensor]);
      }
    }
    return map;
  }, [assetId, review.sensors]);
  const retryDevices = useCallback(() => devices.refetch(), [devices.refetch]);
  const { refetch: retryReview } = review;
  const closePause = useCallback(() => setSelected(undefined), []);
  return (
    <SectionCard
      actions={
        <>
          {canRegister ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/devices/new"
            >
              Add device
            </Link>
          ) : null}
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/devices"
          >
            Manage devices
          </Link>
        </>
      }
      icon={RadioTower}
      title="Devices"
    >
      <div className="grid gap-4">
        {devices.isPending ? (
          <LoadingState label="Loading devices…" rows={2} />
        ) : null}
        {devices.error ? (
          <ErrorState
            message={devices.error.message}
            onRetry={retryDevices}
            retryLabel="Retry devices"
          />
        ) : null}
        {review.error ? (
          <ErrorState
            message={review.error.message}
            onRetry={retryReview}
            retryLabel="Retry device monitoring"
          />
        ) : null}
        {devices.data?.length === 0 ? (
          <EmptyState
            description={
              canRegister
                ? "Use Add device to register the first sensor"
                : "Registered sensors appear here"
            }
            title="No devices yet"
          />
        ) : null}
        {devices.data?.length ? (
          <ul aria-label="Asset devices" className="grid gap-3">
            {devices.data.map((device) => (
              <OverviewDeviceItem
                canManage={review.canManage}
                device={device}
                key={device.id}
                onPause={setSelected}
                sensors={byDevice.get(device.id) ?? []}
              />
            ))}
          </ul>
        ) : null}
      </div>
      {selected && review.canManage ? (
        <PauseSensorDialog
          estateId={estateId}
          onClose={closePause}
          sensor={selected}
        />
      ) : null}
    </SectionCard>
  );
}
