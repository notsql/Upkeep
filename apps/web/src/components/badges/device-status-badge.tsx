import { Badge } from "@proj/ui/components/badge";
import type { DeviceStatus } from "@/lib/devices";
import { badgeVariantFor, deviceStatusTone } from "@/lib/status-tone";

const labels: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  AWAITING_FIRST_READING: "Waiting for first reading",
  DEACTIVATED: "Turned off",
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge
      className="whitespace-normal"
      variant={badgeVariantFor(deviceStatusTone[status])}
    >
      {labels[status]}
    </Badge>
  );
}
