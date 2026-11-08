import { Badge } from "@proj/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@proj/ui/components/tooltip";
import { Fragment, useId } from "react";
import { type DeviceMetric, deviceMetrics } from "@/lib/devices";
import { formatDateTime, formatMetricNumber, formatTime } from "@/lib/format";
import { flagLabel, type ReadingFlag, type ReadingGroup } from "@/lib/readings";

type GroupedMetric = ReadingGroup["metrics"][number];

const CATALOGUE = Object.keys(deviceMetrics) as DeviceMetric[];

const SHORT_FLAG: Record<Exclude<ReadingFlag["type"], "ANOMALY">, string> = {
  OUT_OF_RANGE: "Out of range",
  GAP: "Gap",
  DUPLICATE_TIMESTAMP: "Duplicate",
};

/** Compact visible headers; the full name stays the accessible name. */
const SHORT_HEADER: Record<DeviceMetric, string> = {
  TEMPERATURE: "Temp °C",
  HUMIDITY: "Humidity %",
  PRESSURE: "Pressure bar",
  FLOW_RATE: "Flow L/min",
  VIBRATION: "Vib. mm/s",
  VIBRATION_ACCELERATION: "Vib. g",
  POWER: "Power kW",
  ENERGY: "Energy kWh",
};

const CELL = "px-1.5 tabular-nums";

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });

function groupKey(group: ReadingGroup): string {
  return [
    group.measuredAt,
    group.source,
    group.deviceId ?? "",
    group.recordedByName ?? "",
  ].join("|");
}

function sourceLabel(group: ReadingGroup, showDevice: boolean): string {
  if (group.source === "MANUAL") {
    return group.recordedByName ? `Manual · ${group.recordedByName}` : "Manual";
  }
  return showDevice && group.deviceIdentifier
    ? `Device · ${group.deviceIdentifier}`
    : "Device";
}

function anomalyFlag(group: ReadingGroup): ReadingFlag | undefined {
  for (const reading of group.metrics) {
    const flag = reading.flags.find(
      (candidate) => candidate.type === "ANOMALY"
    );
    if (flag) {
      return flag;
    }
  }
  return undefined;
}

function CellFlag({ flag, unit }: { flag: ReadingFlag; unit: string }) {
  const label = flagLabel(flag, unit);
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        render={
          <Badge
            className="h-auto py-0"
            render={<button type="button" />}
            variant="outline"
          />
        }
      >
        {SHORT_FLAG[flag.type as keyof typeof SHORT_FLAG]}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MetricCell({ readings }: { readings: GroupedMetric[] }) {
  if (readings.length === 0) {
    return (
      <TableCell
        aria-label="No reading"
        className={`${CELL} text-muted-foreground`}
      >
        —
      </TableCell>
    );
  }
  return (
    <TableCell className={`${CELL} whitespace-nowrap`}>
      <div className="flex flex-col gap-1">
        {readings.map((reading) => (
          <div
            className="flex flex-col items-start gap-1"
            key={reading.readingId}
          >
            <span>
              {formatMetricNumber(
                reading.metric,
                reading.valueText ?? reading.value
              )}
            </span>
            {reading.flags
              .filter((flag) => flag.type !== "ANOMALY")
              .map((flag) => (
                <CellFlag flag={flag} key={flag.type} unit={reading.unit} />
              ))}
          </div>
        ))}
      </div>
    </TableCell>
  );
}

function GroupRow({
  group,
  metrics,
  showDevice,
  showSource,
}: {
  group: ReadingGroup;
  metrics: DeviceMetric[];
  showDevice: boolean;
  showSource: boolean;
}) {
  const anomalyId = useId();
  const anomaly = anomalyFlag(group);
  return (
    <TableRow aria-describedby={anomaly ? anomalyId : undefined}>
      <TableCell
        className={`${CELL} bg-background sticky left-0 whitespace-nowrap`}
        title={formatDateTime(group.measuredAt)}
      >
        {formatTime(group.measuredAt)}
      </TableCell>
      {metrics.map((metric) => (
        <MetricCell
          key={metric}
          readings={group.metrics.filter(
            (reading) => reading.metric === metric
          )}
        />
      ))}
      {showSource ? (
        <TableCell className={`${CELL} whitespace-nowrap`}>
          {sourceLabel(group, showDevice)}
        </TableCell>
      ) : null}
      <TableCell className={CELL}>
        {anomaly ? (
          <Badge id={anomalyId} variant="destructive">
            {flagLabel(anomaly, "")}
          </Badge>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** One row per (time, source, device); a column per metric present. */
export function GroupedReadingsTable({
  groups,
  label = "Latest readings",
  metrics: only,
  refreshing,
}: {
  groups: ReadingGroup[];
  /** The table's accessible name. */
  label?: string;
  /** Restricts the columns to these metrics. */
  metrics?: DeviceMetric[];
  refreshing: boolean;
}) {
  const present = new Set(
    groups.flatMap((group) => group.metrics.map((reading) => reading.metric))
  );
  const metrics = CATALOGUE.filter(
    (metric) => present.has(metric) && (!only || only.includes(metric))
  );
  const devices = new Set(
    groups.flatMap((group) => (group.deviceId ? [group.deviceId] : []))
  );
  const showDevice = devices.size > 1;
  // Source says nothing when every row comes from the one device.
  const showSource =
    showDevice || groups.some((group) => group.source === "MANUAL");
  const columns = metrics.length + (showSource ? 3 : 2);
  let previousDay: string | undefined;
  return (
    <div
      aria-busy={refreshing}
      className="max-w-full min-w-0 overflow-x-auto rounded-xl border"
    >
      <Table aria-label={label}>
        <TableHeader>
          <TableRow>
            <TableHead className={`${CELL} bg-background sticky left-0`}>
              Time
            </TableHead>
            {metrics.map((metric) => {
              const full = `${deviceMetrics[metric].name} (${deviceMetrics[metric].unit})`;
              return (
                <TableHead
                  aria-label={full}
                  className={`${CELL} whitespace-nowrap`}
                  key={metric}
                  title={full}
                >
                  {SHORT_HEADER[metric]}
                </TableHead>
              );
            })}
            {showSource ? <TableHead className={CELL}>Source</TableHead> : null}
            <TableHead className={CELL}>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const day = dayFormat.format(new Date(group.measuredAt));
            const newDay = day !== previousDay;
            previousDay = day;
            return (
              <Fragment key={groupKey(group)}>
                {newDay ? (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead
                      className="sticky left-0"
                      colSpan={columns}
                      scope="rowgroup"
                    >
                      {day}
                    </TableHead>
                  </TableRow>
                ) : null}
                <GroupRow
                  group={group}
                  metrics={metrics}
                  showDevice={showDevice}
                  showSource={showSource}
                />
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
