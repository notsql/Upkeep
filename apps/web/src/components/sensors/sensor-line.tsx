import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import { metricLabel, timeLabel } from "@/components/sensors/sensor-format";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";

const stateLabels: Record<MonitoredSensor["state"], string> = {
  NOT_CONFIGURED: "Not configured",
  NO_DATA: "No readings yet",
  WAITING_FOR_READINGS: "Waiting for fresh readings",
  MONITORING: "Monitoring",
  FLATLINED: "Possible flatline",
  PAUSED: "Paused",
};

function stateLabel(sensor: MonitoredSensor): string {
  if (sensor.state === "PAUSED" && sensor.pause) {
    return `Paused until ${timeLabel(sensor.pause.resumesAt)}`;
  }
  return stateLabels[sensor.state];
}

/** One metric of a device: its flatline state and, when allowed, Pause for maintenance. */
export function SensorLine({
  sensor,
  canManage,
  onPause,
}: {
  sensor: MonitoredSensor;
  canManage: boolean;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const pause = useCallback(() => onPause(sensor), [onPause, sensor]);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span>{metricLabel(sensor.metric)}</span>
      <Badge
        className="h-auto whitespace-normal"
        variant={sensor.state === "FLATLINED" ? "destructive" : "secondary"}
      >
        {stateLabel(sensor)}
      </Badge>
      {canManage &&
      sensor.thresholdMinutes !== null &&
      sensor.state !== "PAUSED" ? (
        <Button
          aria-label={`Pause ${sensor.deviceIdentifier} ${metricLabel(sensor.metric).toLowerCase()}`}
          onClick={pause}
          size="sm"
          variant="ghost"
        >
          Pause for maintenance
        </Button>
      ) : null}
    </li>
  );
}
