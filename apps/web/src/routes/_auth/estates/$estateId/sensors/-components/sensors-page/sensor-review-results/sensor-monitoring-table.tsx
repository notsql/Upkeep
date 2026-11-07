import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";

import { SensorIdentity } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-identity";
import { SensorMaintenance } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-maintenance";
import { SensorMeasurement } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-measurement";
import { SensorRow } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-row";
import { SensorStatus } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-status";

export function SensorMonitoringTable({
  sensors,
  canManage,
  onPause,
}: {
  sensors: MonitoredSensor[];
  canManage: boolean;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const mobile = useMobile();
  if (mobile) {
    return (
      <ul
        aria-label="Device metrics"
        className="bg-card min-w-0 divide-y rounded-xl border"
      >
        {sensors.map((sensor) => (
          <li
            className="grid min-w-0 gap-4 p-4"
            key={`${sensor.deviceId}-${sensor.metric}`}
          >
            <div className="min-w-0">
              <SensorIdentity sensor={sensor} />
              <p className="mt-2 text-sm">
                {metricLabel(sensor.metric)} ({sensor.unit})
              </p>
            </div>
            <SensorStatus sensor={sensor} />
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Last measurement</p>
              <SensorMeasurement sensor={sensor} />
            </div>
            <SensorMaintenance
              canManage={canManage}
              onPause={onPause}
              sensor={sensor}
            />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Table
      aria-label="Device metrics"
      className="[&_td]:align-top [&_td]:whitespace-normal"
    >
      <TableHeader>
        <TableRow>
          <TableHead>Device / asset</TableHead>
          <TableHead>Metric</TableHead>
          <TableHead>Status and evidence</TableHead>
          <TableHead>Last measurement</TableHead>
          <TableHead>Maintenance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sensors.map((sensor) => (
          <SensorRow
            canManage={canManage}
            key={`${sensor.deviceId}-${sensor.metric}`}
            onPause={onPause}
            sensor={sensor}
          />
        ))}
      </TableBody>
    </Table>
  );
}
