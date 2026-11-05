import { Badge } from "@proj/ui/components/badge";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { timeLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

const labels: Record<MonitoredSensor["state"], string> = {
  NOT_CONFIGURED: "Not configured",
  NO_DATA: "No readings yet",
  WAITING_FOR_READINGS: "Waiting for fresh readings",
  MONITORING: "Monitoring",
  FLATLINED: "Possible flatline",
  PAUSED: "Maintenance paused",
};

export function SensorStatus({ sensor }: { sensor: MonitoredSensor }) {
  return (
    <div className="min-w-0 text-sm">
      <Badge
        className="h-auto text-left whitespace-normal"
        variant={sensor.state === "FLATLINED" ? "destructive" : "secondary"}
      >
        {labels[sensor.state]}
      </Badge>
      {sensor.flatline ? (
        <div className="mt-2">
          <p>Unchanged for {sensor.flatline.observedDurationSeconds} seconds</p>
          <p>Since {timeLabel(sensor.flatline.unchangedSince)}</p>
          <p>
            Range {sensor.flatline.minimumValue}–{sensor.flatline.maximumValue}{" "}
            {sensor.unit}
          </p>
        </div>
      ) : null}
      {sensor.state === "WAITING_FOR_READINGS" ? (
        <p>
          More measurement evidence is needed after maintenance or the device
          clock catches up.
        </p>
      ) : null}
    </div>
  );
}
