import { Badge } from "@proj/ui/components/badge";
import { cn } from "@proj/ui/lib/utils";
import type { DeviceStatus } from "@/lib/devices";
import { type StatusTone, statusToneClassName } from "@/lib/status-tone";

const labels: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  AWAITING_FIRST_READING: "Awaiting first reading",
  DEACTIVATED: "Deactivated",
};

export const deviceStatusTone = {
  ONLINE: "success",
  OFFLINE: "danger",
  AWAITING_FIRST_READING: "neutral",
  DEACTIVATED: "muted",
} as const satisfies Record<DeviceStatus, StatusTone>;

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge
      className={cn(
        "whitespace-normal",
        statusToneClassName[deviceStatusTone[status]]
      )}
      variant="outline"
    >
      {labels[status]}
    </Badge>
  );
}
