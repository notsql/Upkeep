import { TableCell, TableRow } from "@proj/ui/components/table";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-format";

import { SensorIdentity } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-identity";
import { SensorMaintenance } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-maintenance";
import { SensorMeasurement } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-measurement";
import { SensorStatus } from "@/routes/_auth/estates/$estateId/sensors/-components/sensors-page/sensor-review-results/sensor-status";

export function SensorRow({
  sensor,
  canManage,
  onPause,
}: {
  sensor: MonitoredSensor;
  canManage: boolean;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  return (
    <TableRow>
      <TableCell className="max-w-56 py-4">
        <SensorIdentity sensor={sensor} />
      </TableCell>
      <TableCell className="py-4">
        {metricLabel(sensor.metric)} ({sensor.unit})
      </TableCell>
      <TableCell className="max-w-72 py-4">
        <SensorStatus sensor={sensor} />
      </TableCell>
      <TableCell className="py-4">
        <SensorMeasurement sensor={sensor} />
      </TableCell>
      <TableCell className="max-w-64 py-4">
        <SensorMaintenance
          canManage={canManage}
          onPause={onPause}
          sensor={sensor}
        />
      </TableCell>
    </TableRow>
  );
}
