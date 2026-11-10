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
import { RadioTower } from "lucide-react";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import { ListRow, ListRows } from "@/components/list/list-row";
import { SensorLine } from "@/components/sensors/sensor-line";
import type { RankedDevice } from "@/lib/asset-monitoring";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { useMobile } from "@/lib/use-mobile";

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
            <LastSeen row={row} />
          </TableCell>
          <TableCell className="py-4">
            {row.status ? <DeviceStatusBadge status={row.status} /> : null}
          </TableCell>
        </>
      ) : null}
      <TableCell className="max-w-80 py-4">
        <Monitoring options={options} row={row} />
      </TableCell>
    </TableRow>
  );
}

function LastSeen({ row }: { row: RankedDevice }) {
  return row.lastSeenAt ? (
    <time dateTime={row.lastSeenAt}>
      {new Date(row.lastSeenAt).toLocaleString()}
    </time>
  ) : (
    "Never"
  );
}

function measurementCount(count: number): string {
  return `${count} ${count === 1 ? "measurement" : "measurements"}`;
}

/**
 * Measurements with warning limits, one line each; the rest folded into one
 * muted line instead of a "No warning set" pill apiece.
 */
function Monitoring({
  row,
  options,
}: {
  row: RankedDevice;
  options: RowOptions;
}) {
  if (row.status === "DEACTIVATED" || row.sensors.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  const limited = row.sensors.filter(
    (sensor) => sensor.state !== "NOT_CONFIGURED"
  );
  const unset = row.sensors.length - limited.length;
  let unsetLine: string | null = null;
  if (limited.length === 0) {
    unsetLine = `No warning limits set · ${measurementCount(unset)}`;
  } else if (unset > 0) {
    unsetLine = `No warning limits on ${unset} other ${unset === 1 ? "measurement" : "measurements"}`;
  }
  return (
    <div className="grid gap-2 text-sm">
      {limited.length > 0 ? (
        <ul
          aria-label={`${row.identifier} measurements`}
          className="grid gap-2"
        >
          {limited.map((sensor) => (
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
      ) : null}
      {unsetLine ? <p className="text-muted-foreground">{unsetLine}</p> : null}
    </div>
  );
}

/**
 * The phone view of one device, matching the asset's sensor rows: icon, name
 * and one status badge, a muted asset · location · last seen line, then the
 * measurements. "Never" seen is left to the status badge.
 */
function AllDevicesItem({
  row,
  options,
}: {
  row: RankedDevice;
  options: RowOptions;
}) {
  const location = options.locationFor(row) ?? "Location unavailable";
  return (
    <ListRow
      icon={RadioTower}
      meta={
        <>
          {options.linkAssets ? (
            <Link
              className="text-foreground font-medium underline underline-offset-4"
              params={{ estateId: options.estateId, assetId: row.assetId }}
              to="/estates/$estateId/assets/$assetId"
            >
              {row.assetName}
            </Link>
          ) : (
            <span>{row.assetName}</span>
          )}
          {` · ${location}`}
          {options.showStatus && row.lastSeenAt ? (
            <>
              {" · Last seen "}
              <LastSeen row={row} />
            </>
          ) : null}
        </>
      }
      title={row.identifier}
      trailing={
        (options.showStatus && row.status) || row.assetRetired ? (
          <div className="flex flex-col items-end gap-1">
            {options.showStatus && row.status ? (
              <DeviceStatusBadge status={row.status} />
            ) : null}
            {row.assetRetired ? (
              <Badge variant="secondary">Out of use</Badge>
            ) : null}
          </div>
        ) : null
      }
    >
      {row.status === "DEACTIVATED" || row.sensors.length === 0 ? null : (
        <Monitoring options={options} row={row} />
      )}
    </ListRow>
  );
}

/** Every device, worst first; the order is fixed by the caller. */
export function AllDevicesTable({
  rows,
  ...options
}: RowOptions & { rows: RankedDevice[] }) {
  const mobile = useMobile();
  if (mobile) {
    return (
      <ListRows label="All sensors">
        {rows.map((row) => (
          <AllDevicesItem key={row.deviceId} options={options} row={row} />
        ))}
      </ListRows>
    );
  }
  return (
    <div className="max-w-full min-w-0 overflow-x-auto rounded-xl border">
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
    </div>
  );
}
