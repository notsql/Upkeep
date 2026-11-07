import type { SensorPolicy } from "@/lib/flatlined-sensors";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";

export function PolicyName({ policy }: { policy: SensorPolicy }) {
  return (
    <>
      <p className="font-medium wrap-anywhere">{metricLabel(policy.metric)}</p>
      <p className="text-muted-foreground text-sm">{policy.unit}</p>
    </>
  );
}
