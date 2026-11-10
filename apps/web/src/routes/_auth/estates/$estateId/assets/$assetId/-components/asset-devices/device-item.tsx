import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import { Link } from "@tanstack/react-router";
import {
  KeyRound,
  MoreHorizontal,
  PowerOff,
  RadioTower,
  Replace,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import { ListRow } from "@/components/list/list-row";
import {
  type Device,
  deviceMetrics,
  formatInterval,
  useDeactivateDevice,
} from "@/lib/devices";
import { formatDateTime, formatRelative } from "@/lib/format";
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            {device.credentialIssuedAt
              ? `Key created ${formatDateTime(device.credentialIssuedAt)}`
              : "No connection key yet"}
          </DropdownMenuLabel>
          <DropdownMenuItem
            disabled={credential.pending}
            onClick={credential.start}
          >
            <KeyRound aria-hidden="true" />
            {credential.actionLabel}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuItem
          render={
            <Link
              params={{ estateId, assetId, deviceId: device.id }}
              to="/estates/$estateId/assets/$assetId/devices/$deviceId/replace"
            />
          }
        >
          <Replace aria-hidden="true" />
          Replace sensor
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDeactivate} variant="destructive">
          <PowerOff aria-hidden="true" />
          Turn off sensor
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MEASURES_SHOWN = 3;

function measuresSummary(device: Device): string {
  const names = device.metrics.map(({ metric }) =>
    deviceMetrics[metric].name.toLowerCase()
  );
  const shown = names.slice(0, MEASURES_SHOWN).join(", ");
  const extra = names.length - MEASURES_SHOWN;
  return extra > 0 ? `Measures ${shown} +${extra} more` : `Measures ${shown}`;
}

/**
 * One device as a calm row: name, one status badge and (while it and the
 * asset are active) a "more" menu; then one muted meta line, a short
 * measures summary, and a single actionable warning when it has never
 * reported. Connection-key details live in the menu.
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
      toast.success("Sensor turned off. We've kept its readings.");
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
    <ListRow
      icon={RadioTower}
      meta={
        <>
          <span>{device.model}</span>
          {" · "}
          <span>{locationPath ?? "Location unavailable"}</span>
          {" · "}
          <span>{formatInterval(device.reportingIntervalSeconds)}</span>
          {device.lastSeenAt ? (
            <>
              {" · "}
              <span title={formatDateTime(device.lastSeenAt)}>
                {`Last seen ${formatRelative(device.lastSeenAt, new Date())}`}
              </span>
            </>
          ) : null}
        </>
      }
      title={<h3 className="break-all">{device.identifier}</h3>}
      trailing={
        <>
          {device.deactivatedAt ? (
            <Badge className="whitespace-normal" variant="secondary">
              {`Turned off ${formatDateTime(device.deactivatedAt)}`}
            </Badge>
          ) : (
            <DeviceStatusBadge status={device.status} />
          )}
          {actionable ? (
            <DeviceActions
              assetId={assetId}
              credential={credential}
              device={device}
              estateId={estateId}
              onDeactivate={openConfirmation}
            />
          ) : null}
        </>
      }
    >
      {device.metrics.length > 0 ? (
        <p className="text-muted-foreground text-sm">
          {measuresSummary(device)}
        </p>
      ) : null}
      {status === "AWAITING_FIRST_READING" ? (
        <p className="text-warning text-sm">
          {`Nothing received since it was added ${formatRelative(device.createdAt, new Date())}. Check it's switched on and has its connection key.`}
        </p>
      ) : null}
      {replaces ? (
        <p className="text-muted-foreground text-sm">Replaces {replaces}</p>
      ) : null}
      {replacedBy ? (
        <p className="text-muted-foreground text-sm">
          Replaced by {replacedBy}
        </p>
      ) : null}
      {actionable ? (
        <DeviceCredentialDialogs credential={credential} device={device} />
      ) : null}
      {confirming ? (
        <DeactivateDeviceDialog
          identifier={device.identifier}
          onCancel={closeConfirmation}
          onConfirm={confirm}
        />
      ) : null}
    </ListRow>
  );
}
