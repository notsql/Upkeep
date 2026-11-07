import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { RadioTower } from "lucide-react";
import { useCallback, useMemo } from "react";
import { SectionCard } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { useDevices } from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";
import { DeviceItem } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/device-item";

export function AssetDevicesSection({
  assetId,
  canRegister,
  estateId,
}: {
  assetId: string;
  canRegister: boolean;
  estateId: string;
}) {
  const devices = useDevices(estateId, assetId);
  const locations = useLocations(estateId);
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
  const identifiers = useMemo(
    () =>
      new Map((devices.data ?? []).map((item) => [item.id, item.identifier])),
    [devices.data]
  );
  const retry = useCallback(() => devices.refetch(), [devices.refetch]);
  return (
    <SectionCard
      actions={
        <>
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/readings/$assetId"
          >
            Readings
          </Link>
          {canRegister ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/devices/new"
            >
              Register device
            </Link>
          ) : null}
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
          <ErrorState message={devices.error.message} onRetry={retry} />
        ) : null}
        {devices.data?.length === 0 ? (
          <div>
            <EmptyState
              description={
                canRegister
                  ? "Use Register device to add the first sensor"
                  : "Registered sensors appear here"
              }
              title="No devices yet"
            />
          </div>
        ) : null}
        <ul aria-label="Devices" className="grid gap-3">
          {devices.data?.map((device) => (
            <DeviceItem
              assetId={assetId}
              canManage={canRegister}
              device={device}
              estateId={estateId}
              identifiers={identifiers}
              key={device.id}
              locationPath={paths.get(device.locationId)}
            />
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}
