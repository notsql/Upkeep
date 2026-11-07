import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import {
  type Device,
  deviceMetrics,
  formatInterval,
  useDeactivateDevice,
} from "@/lib/devices";
import { DeactivateDeviceDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/deactivate-device-dialog";
import { DeviceCredential } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/device-credential";

function metricSummary(device: Device): string {
  return device.metrics
    .map(({ metric, unit }) => `${deviceMetrics[metric].name} (${unit})`)
    .join(", ");
}

/** One device. Deactivated devices keep their details but lose every action (ID-45). */
export function DeviceItem({
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
        <h3 className="font-medium break-all">{device.identifier}</h3>
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
        <p className="text-muted-foreground mt-1 text-sm">
          Replaces {replaces}
        </p>
      ) : null}
      {replacedBy ? (
        <p className="text-muted-foreground mt-1 text-sm">
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
