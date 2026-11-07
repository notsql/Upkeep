import { useId } from "react";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import { SensorLine } from "@/components/sensors/sensor-line";
import type { Device } from "@/lib/devices";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";

/** One device on the Overview: identity, status, and its flatline state per metric. */
export function OverviewDeviceItem({
  device,
  sensors,
  canManage,
  onPause,
}: {
  device: Device;
  sensors: MonitoredSensor[];
  canManage: boolean;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const headingId = useId();
  const active = !device.deactivatedAt;
  return (
    <li aria-labelledby={headingId} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-medium break-all" id={headingId}>
          {device.identifier}
        </h3>
        <DeviceStatusBadge status={device.status} />
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        {device.lastSeenAt
          ? `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`
          : "Not seen yet"}
      </p>
      {active && sensors.length ? (
        <ul
          aria-label={`${device.identifier} metrics`}
          className="mt-3 grid gap-2 text-sm"
        >
          {sensors.map((sensor) => (
            <SensorLine
              canManage={canManage}
              key={sensor.metric}
              onPause={onPause}
              sensor={sensor}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
