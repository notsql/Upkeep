import { TableCell, TableRow } from "@proj/ui/components/table";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { metricLabel } from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

import { SensorIdentity } from "./sensor-identity";
import { SensorMaintenance } from "./sensor-maintenance";
import { SensorMeasurement } from "./sensor-measurement";
import { SensorStatus } from "./sensor-status";

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
