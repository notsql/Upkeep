import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import { metricLabel } from "@/components/sensors/sensor-format";
import type { SensorPolicy } from "@/lib/flatlined-sensors";

export function PolicyAction({
  policy,
  saving,
  id,
  onOpen,
}: {
  policy: SensorPolicy;
  saving: boolean;
  id: string;
  onOpen: (metric: SensorPolicy["metric"]) => void;
}) {
  const open = useCallback(
    () => onOpen(policy.metric),
    [onOpen, policy.metric]
  );
  const label = policy.durationMinutes === null ? "Set up" : "Edit";
  return (
    <Button
      aria-haspopup="dialog"
      aria-label={`${label} ${metricLabel(policy.metric).toLowerCase()} policy`}
      disabled={saving}
      id={id}
      onClick={open}
      variant="ghost"
    >
      {label}
    </Button>
  );
}
