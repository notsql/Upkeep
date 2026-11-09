import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { KeyRound, MoreHorizontal, PowerOff, Replace } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import {
  type Device,
  deviceMetrics,
  formatInterval,
  useDeactivateDevice,
} from "@/lib/devices";
import { formatDateTime, formatRelative } from "@/lib/format";
import { deviceStatusTone, statusDotClassName } from "@/lib/status-tone";
import { DeactivateDeviceDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/deactivate-device-dialog";
import {
  DeviceCredentialDialogs,
  type DeviceCredentialState,
  useDeviceCredential,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/device-credential";

function DeviceActions({
  assetId,
  credential,
  device,
  estateId,
  onDeactivate,
}: {
  assetId: string;
  credential: DeviceCredentialState;
  device: Device;
  estateId: string;
  onDeactivate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${device.identifier}`}
            className="shrink-0"
            size="icon"
            variant="ghost"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          disabled={credential.pending}
          onClick={credential.start}
        >
          <KeyRound aria-hidden="true" />
          {credential.actionLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link
              params={{ estateId, assetId, deviceId: device.id }}
              to="/estates/$estateId/assets/$assetId/devices/$deviceId/replace"
            />
          }
        >
          <Replace aria-hidden="true" />
          Replace device
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDeactivate} variant="destructive">
          <PowerOff aria-hidden="true" />
          Deactivate device
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * One device as a row: status dot, name and meta, metric chips, status and
 * last seen, and (while it and the asset are active) a "more" menu.
 * Deactivated devices keep their details but lose every action (ID-45).
 */
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
  const credential = useDeviceCredential(estateId, assetId, device);
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
  const status = device.deactivatedAt ? "DEACTIVATED" : device.status;
  const replaces = device.replacesDeviceId
    ? identifiers.get(device.replacesDeviceId)
    : undefined;
  const replacedBy = device.replacedByDeviceId
    ? identifiers.get(device.replacedByDeviceId)
    : undefined;
  return (
    <li className="grid gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-2 size-2 shrink-0 rounded-full",
            statusDotClassName[deviceStatusTone[status]]
          )}
        />
        <div className="grid min-w-0 flex-1 gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-medium break-all">{device.identifier}</h3>
            {device.deactivatedAt ? (
              <Badge className="whitespace-normal" variant="secondary">
                {`Deactivated ${formatDateTime(device.deactivatedAt)}`}
              </Badge>
            ) : (
              <DeviceStatusBadge status={device.status} />
            )}
            {device.lastSeenAt ? (
              <span
                className="text-muted-foreground text-xs"
                title={formatDateTime(device.lastSeenAt)}
              >
                {`Last seen ${formatRelative(device.lastSeenAt, new Date())}`}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
            <span className="break-words">{device.model}</span>
            <span aria-hidden="true">·</span>
            <span>{locationPath ?? "Location unavailable"}</span>
            <span aria-hidden="true">·</span>
            <span>{`Reports ${formatInterval(device.reportingIntervalSeconds).toLowerCase()}`}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {device.metrics.map(({ metric, unit }) => (
              <Badge key={metric} variant="outline">
                {`${deviceMetrics[metric].name} (${unit})`}
              </Badge>
            ))}
          </div>
          {replaces ? (
            <p className="text-muted-foreground text-sm">Replaces {replaces}</p>
          ) : null}
          {replacedBy ? (
            <p className="text-muted-foreground text-sm">
              Replaced by {replacedBy}
            </p>
          ) : null}
          {active ? (
            <p className="text-muted-foreground text-xs">
              {device.credentialIssuedAt
                ? `Credential issued ${formatDateTime(device.credentialIssuedAt)}`
                : "No credential"}
            </p>
          ) : null}
          {actionable ? (
            <DeviceCredentialDialogs credential={credential} device={device} />
          ) : null}
        </div>
        {actionable ? (
          <DeviceActions
            assetId={assetId}
            credential={credential}
            device={device}
            estateId={estateId}
            onDeactivate={openConfirmation}
          />
        ) : null}
      </div>
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
