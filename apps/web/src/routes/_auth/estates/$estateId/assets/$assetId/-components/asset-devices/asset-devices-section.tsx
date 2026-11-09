import { Link } from "@tanstack/react-router";
import { Activity, Cpu, Plus, RadioTower } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  PageSection,
  sectionActionClassName,
} from "@/components/page/section-card";
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
    <PageSection
      actions={
        <>
          <Link
            className={sectionActionClassName}
            params={{ estateId, assetId }}
            to="/estates/$estateId/readings/$assetId"
          >
            <Activity aria-hidden="true" />
            Readings
          </Link>
          {canRegister ? (
            <Link
              className={sectionActionClassName}
              params={{ estateId, assetId }}
              to="/estates/$estateId/assets/$assetId/devices/new"
            >
              <Plus aria-hidden="true" />
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
              icon={Cpu}
              title="No devices yet"
            />
          </div>
        ) : null}
        <ul aria-label="Devices" className="divide-y">
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
    </PageSection>
  );
}
