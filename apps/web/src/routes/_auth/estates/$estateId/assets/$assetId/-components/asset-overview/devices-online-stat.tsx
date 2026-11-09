import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { activeDevices, useDevices } from "@/lib/devices";
import { statusDotClassName } from "@/lib/status-tone";

const DOTS = {
  all: statusDotClassName.success,
  some: statusDotClassName.warning,
  none: statusDotClassName.neutral,
} as const;

/** "N of M devices online", linking to the Devices tab; hidden with no devices. */
export function DevicesOnlineStat({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const devices = useDevices(estateId, assetId);
  const active = devices.data ? activeDevices(devices.data) : [];
  if (!active.length) {
    return null;
  }
  const online = active.filter((device) => device.status === "ONLINE").length;
  let tone: keyof typeof DOTS = "some";
  if (online === active.length) {
    tone = "all";
  } else if (online === 0) {
    tone = "none";
  }
  return (
    <Link
      className="hover:text-foreground text-muted-foreground inline-flex items-center gap-2 rounded-md text-sm whitespace-nowrap underline-offset-4 hover:underline"
      data-tone={tone}
      params={{ estateId, assetId }}
      to="/estates/$estateId/assets/$assetId/devices"
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", DOTS[tone])}
      />
      {`${online} of ${active.length} ${active.length === 1 ? "device" : "devices"} online`}
    </Link>
  );
}
