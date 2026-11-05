import { Button } from "@proj/ui/components/button";
import { useCallback } from "react";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import {
  metricLabel,
  timeLabel,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

export function SensorMaintenance({
  sensor,
  canManage,
  onPause,
}: {
  sensor: MonitoredSensor;
  canManage: boolean;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const pauseSensor = useCallback(() => onPause(sensor), [onPause, sensor]);
  return (
    <div className="space-y-2 text-sm wrap-anywhere">
      {sensor.pause ? (
        <p className="text-muted-foreground">
          {sensor.state === "PAUSED" ? "Resumes" : "Fresh-start cutoff"}:{" "}
          <time dateTime={sensor.pause.resumesAt}>
            {timeLabel(sensor.pause.resumesAt)}
          </time>
        </p>
      ) : null}
      {canManage &&
      sensor.thresholdMinutes !== null &&
      sensor.state !== "PAUSED" ? (
        <Button
          aria-label={`Pause ${sensor.deviceIdentifier} ${metricLabel(sensor.metric).toLowerCase()}`}
          className="w-full sm:w-auto"
          onClick={pauseSensor}
          variant="ghost"
        >
          Pause for maintenance
        </Button>
      ) : null}
    </div>
  );
}
