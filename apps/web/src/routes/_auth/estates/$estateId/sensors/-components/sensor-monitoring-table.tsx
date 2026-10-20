import { Badge } from "@proj/ui/components/badge";
import { Button } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback } from "react";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";
import {
  metricLabel,
  timeLabel,
} from "@/routes/_auth/estates/$estateId/sensors/-components/sensor-format";

const labels: Record<MonitoredSensor["state"], string> = {
  NOT_CONFIGURED: "Not configured",
  NO_DATA: "No readings yet",
  WAITING_FOR_READINGS: "Waiting for fresh readings",
  MONITORING: "Monitoring",
  FLATLINED: "Possible flatline",
  PAUSED: "Maintenance paused",
};

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
        className="min-w-0 divide-y rounded-xl border bg-card"
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
              <p className="mb-1 text-muted-foreground">Last measurement</p>
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
      className="[&_td]:whitespace-normal [&_td]:align-top"
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

function SensorRow({
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

function SensorIdentity({ sensor }: { sensor: MonitoredSensor }) {
  return (
    <div className="wrap-anywhere">
      <p className="font-medium">{sensor.deviceIdentifier}</p>
      <p className="text-muted-foreground text-sm">{sensor.assetName}</p>
      <p className="text-muted-foreground text-sm">{sensor.assetReference}</p>
      {sensor.assetLocationPath === sensor.deviceLocationPath ? (
        <p className="mt-2 text-muted-foreground text-sm">
          Location: {sensor.assetLocationPath}
        </p>
      ) : (
        <div className="mt-2 text-muted-foreground text-sm">
          <p>Asset location: {sensor.assetLocationPath}</p>
          <p>Device location: {sensor.deviceLocationPath}</p>
        </div>
      )}
    </div>
  );
}

function SensorStatus({ sensor }: { sensor: MonitoredSensor }) {
  return (
    <div className="min-w-0 text-sm">
      <Badge
        className="h-auto whitespace-normal text-left"
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

function SensorMeasurement({ sensor }: { sensor: MonitoredSensor }) {
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

function SensorMaintenance({
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
    <div className="wrap-anywhere space-y-2 text-sm">
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
          variant="outline"
        >
          Pause for maintenance
        </Button>
      ) : null}
    </div>
  );
}
