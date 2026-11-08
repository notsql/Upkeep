import { Badge } from "@proj/ui/components/badge";
import type { SensorPolicy } from "@/lib/flatlined-sensors";

export function PolicyStatus({ policy }: { policy: SensorPolicy }) {
  const configured = policy.durationMinutes !== null;
  return (
    <Badge variant={configured ? "default" : "secondary"}>
      {configured ? "Configured" : "Not set"}
    </Badge>
  );
}
