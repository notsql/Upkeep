import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeviceStatusBadge } from "@/components/device-status-badge";
import {
  type Device,
  deviceMetrics,
  formatInterval,
  useDeactivateDevice,
  useDevices,
} from "@/lib/devices";
import { flattenLocations, useLocations } from "@/lib/locations";
import { DeactivateDeviceDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-device-dialog";
import { DeviceCredential } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/device-credential";

function metricSummary(device: Device): string {
  return device.metrics
    .map(({ metric, unit }) => `${deviceMetrics[metric].name} (${unit})`)
    .join(", ");
}

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
          node.path.join(" > "),
        ])
      ),
    [locations.data]
  );
  const identifiers = useMemo(
    () =>
      new Map((devices.data ?? []).map((item) => [item.id, item.identifier])),
    [devices.data]
  );
  return (
    <section aria-labelledby="devices-heading" className="section-surface mt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-semibold text-xl" id="devices-heading">
          Devices
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className={buttonVariants({ variant: "outline" })}
            params={{ estateId, assetId }}
            to="/estates/$estateId/assets/$assetId/readings"
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
        </div>
      </div>
      {devices.isPending ? (
        <p aria-live="polite" className="mt-4">
          Loading devices…
        </p>
      ) : null}
      {devices.error ? (
        <p className="mt-4 text-destructive" role="alert">
          {devices.error.message}
        </p>
      ) : null}
      {devices.data?.length === 0 ? (
        <p className="mt-4 text-muted-foreground">
          No devices are registered to this asset yet.
        </p>
      ) : null}
      <ul aria-label="Devices" className="mt-4 grid gap-3">
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
    </section>
  );
}

/** One device. Deactivated devices keep their details but lose every action (ID-45). */
function DeviceItem({
  assetId,
  canManage,
  device,
  estateId,
  identifiers,
  locationPath,
}: {
  assetId: string;
  canManage: boolean;
  device: Device;
  estateId: string;
  identifiers: Map<string, string>;
  locationPath?: string;
}) {
  const deactivate = useDeactivateDevice(estateId, assetId);
  const [confirming, setConfirming] = useState(false);
  const openConfirmation = useCallback(() => setConfirming(true), []);
  const closeConfirmation = useCallback(() => setConfirming(false), []);
  const confirm = useCallback(
    async (identifier: string) => {
      await deactivate.mutateAsync({ deviceId: device.id, identifier });
      setConfirming(false);
      toast.success("Device deactivated. Its readings are kept.");
    },
    [deactivate.mutateAsync, device.id]
  );
  const active = !device.deactivatedAt;
  const actionable = canManage && active;
  const replaces = device.replacesDeviceId
    ? identifiers.get(device.replacesDeviceId)
    : undefined;
  const replacedBy = device.replacedByDeviceId
    ? identifiers.get(device.replacedByDeviceId)
    : undefined;
  return (
    <li className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="break-all font-medium">{device.identifier}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {device.lastSeenAt ? (
            <Badge className="whitespace-normal" variant="outline">
              {`Last seen ${new Date(device.lastSeenAt).toLocaleString()}`}
            </Badge>
          ) : null}
          {device.deactivatedAt ? (
            <Badge className="whitespace-normal" variant="secondary">
              {`Deactivated ${new Date(device.deactivatedAt).toLocaleString()}`}
            </Badge>
          ) : (
            <DeviceStatusBadge status={device.status} />
          )}
        </div>
      </div>
      {replaces ? (
        <p className="mt-1 text-muted-foreground text-sm">
          Replaces {replaces}
        </p>
      ) : null}
      {replacedBy ? (
        <p className="mt-1 text-muted-foreground text-sm">
          Replaced by {replacedBy}
        </p>
      ) : null}
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Model</dt>
          <dd className="break-words">{device.model}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Location</dt>
          <dd>{locationPath ?? "Location unavailable"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Metrics</dt>
          <dd>{metricSummary(device)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Reporting</dt>
          <dd>{formatInterval(device.reportingIntervalSeconds)}</dd>
        </div>
      </dl>
      {active ? (
        <DeviceCredential
          assetId={assetId}
          canManage={canManage}
          device={device}
          estateId={estateId}
        />
      ) : null}
      {actionable ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            aria-label={`Replace ${device.identifier}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
            params={{ estateId, assetId, deviceId: device.id }}
            to="/estates/$estateId/assets/$assetId/devices/$deviceId/replace"
          >
            Replace device
          </Link>
          <Button
            aria-label={`Deactivate ${device.identifier}`}
            onClick={openConfirmation}
            size="sm"
            variant="outline"
          >
            Deactivate device
          </Button>
        </div>
      ) : null}
      {confirming ? (
        <DeactivateDeviceDialog
          identifier={device.identifier}
          onCancel={closeConfirmation}
          onConfirm={confirm}
        />
      ) : null}
    </li>
  );
}
