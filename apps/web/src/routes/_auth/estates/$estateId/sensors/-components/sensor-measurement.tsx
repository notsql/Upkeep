import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { timeLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

export function SensorMeasurement({ sensor }: { sensor: MonitoredSensor }) {
  return (
    <div className="wrap-anywhere">
      {sensor.lastReadingAt ? (
        <>
          <p>
            {sensor.lastValue} {sensor.unit}
          </p>
          <time
            className="text-muted-foreground text-sm"
            dateTime={sensor.lastReadingAt}
          >
            {timeLabel(sensor.lastReadingAt)}
          </time>
        </>
      ) : (
        "No eligible measurement"
      )}
    </div>
  );
}
