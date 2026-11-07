import { Cpu } from "lucide-react";
import { SummaryCard } from "@/components/page/summary-card";
import { useEstateDevices } from "@/lib/devices";

export function DeviceStat({ estateId }: { estateId: string }) {
  const devices = useEstateDevices(estateId);
  const items = devices.data ?? [];
  const offline = items.filter((device) => device.status === "OFFLINE").length;
  const online = items.filter((device) => device.status === "ONLINE").length;
  return (
    <SummaryCard
      icon={Cpu}
      title="Offline devices"
      value={offline}
      warning={offline > 0}
    >
      <span className="text-muted-foreground text-sm">Online: {online}</span>
    </SummaryCard>
  );
}
