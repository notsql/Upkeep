import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Link } from "@tanstack/react-router";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import { SensorLine } from "@/components/sensors/sensor-line";
import type { RankedDevice } from "@/lib/asset-monitoring";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";

interface RowOptions {
  canManage: boolean;
  canReplace: boolean;
  estateId: string;
  linkAssets: boolean;
  locationFor: (row: RankedDevice) => string | undefined;
  onPause: (sensor: MonitoredSensor) => void;
  showStatus: boolean;
}

function AllDevicesRow({
  row,
  options,
}: {
  row: RankedDevice;
  options: RowOptions;
}) {
  const active = row.status !== "DEACTIVATED";
  return (
    <TableRow>
      <TableHead className="max-w-56 py-4 font-normal" scope="row">
        <p className="font-medium wrap-anywhere">{row.identifier}</p>
        {row.model ? (
          <p className="text-muted-foreground text-sm wrap-anywhere">
            {row.model}
          </p>
        ) : null}
      </TableHead>
      <TableCell className="max-w-56 py-4">
        {options.linkAssets ? (
          <Link
            className="font-medium wrap-anywhere underline-offset-4 hover:underline"
            params={{ estateId: options.estateId, assetId: row.assetId }}
            to="/estates/$estateId/assets/$assetId"
          >
            {row.assetName}
          </Link>
        ) : (
          <p className="font-medium wrap-anywhere">{row.assetName}</p>
        )}
        <p className="text-muted-foreground text-sm">{row.assetReference}</p>
        {row.assetRetired ? (
          <Badge className="mt-1" variant="secondary">
            Out of use
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className="py-4">
        {options.locationFor(row) ?? "Location unavailable"}
      </TableCell>
      {options.showStatus ? (
        <>
          <TableCell className="py-4">
            {row.lastSeenAt ? (
              <time dateTime={row.lastSeenAt}>
                {new Date(row.lastSeenAt).toLocaleString()}
              </time>
            ) : (
              "Never"
            )}
          </TableCell>
          <TableCell className="py-4">
            {row.status ? <DeviceStatusBadge status={row.status} /> : null}
          </TableCell>
        </>
      ) : null}
      <TableCell className="max-w-80 py-4">
        {active && row.sensors.length ? (
          <ul
            aria-label={`${row.identifier} measurements`}
            className="grid gap-2 text-sm"
          >
            {row.sensors.map((sensor) => (
              <SensorLine
                canManage={options.canManage}
                canReplace={options.canReplace && !row.assetRetired}
                estateId={options.estateId}
                key={sensor.metric}
                onPause={options.onPause}
                sensor={sensor}
              />
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Every device, worst first; the order is fixed by the caller. */
export function AllDevicesTable({
  rows,
  ...options
}: RowOptions & { rows: RankedDevice[] }) {
  return (
    <Table
      aria-label="All sensors"
      className="[&_td]:align-top [&_td]:whitespace-normal [&_th[scope=row]]:align-top [&_th[scope=row]]:whitespace-normal"
    >
      <TableHeader>
        <TableRow>
          <TableHead>Sensor</TableHead>
          <TableHead>Asset</TableHead>
          <TableHead>Location</TableHead>
          {options.showStatus ? (
            <>
              <TableHead>Last seen</TableHead>
              <TableHead>Status</TableHead>
            </>
          ) : null}
          <TableHead>Monitoring</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <AllDevicesRow key={row.deviceId} options={options} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}
