import { Badge } from "@proj/ui/components/badge";
import type { DeviceStatus } from "@/lib/devices";

const labels: Record<DeviceStatus, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  AWAITING_FIRST_READING: "Awaiting first reading",
  DEACTIVATED: "Deactivated",
};

const variants = {
  ONLINE: "secondary",
  OFFLINE: "destructive",
  AWAITING_FIRST_READING: "outline",
  DEACTIVATED: "secondary",
} as const satisfies Record<DeviceStatus, string>;

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge className="whitespace-normal" variant={variants[status]}>
      {labels[status]}
    </Badge>
  );
}
