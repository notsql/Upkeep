import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { metricLabel, timeLabel } from "@/components/sensors/sensor-format";
import { AskSomeoneLine } from "@/components/who-can-help/ask-someone-line";
import type { MonitoredSensor } from "@/lib/flatlined-sensors";
import { formatDuration, formatMetricValue } from "@/lib/format";

const stateLabels: Record<MonitoredSensor["state"], string> = {
  NOT_CONFIGURED: "No warning set",
  NO_DATA: "No readings yet",
  WAITING_FOR_READINGS: "Waiting for new readings",
  MONITORING: "Working",
  FLATLINED: "Sensor may not be working",
  PAUSED: "Warnings paused",
};

function stateLabel(sensor: MonitoredSensor): string {
  if (sensor.state === "PAUSED" && sensor.pause) {
    return `Warnings paused until ${timeLabel(sensor.pause.resumesAt)}`;
  }
  return stateLabels[sensor.state];
}

/** "It has sent the same reading (21.4 °C) for 3 hrs." */
function sameReading(sensor: MonitoredSensor): string | null {
  const value = sensor.flatline?.latestValue ?? sensor.lastValue;
  const seconds =
    sensor.flatline?.observedDurationSeconds ??
    (sensor.thresholdMinutes === null ? null : sensor.thresholdMinutes * 60);
  if (value === null || seconds === null) {
    return null;
  }
  return `It has sent the same reading (${formatMetricValue(sensor.metric, value)}) for ${formatDuration(seconds)}.`;
}

/** What to do about a sensor that may not be working (spec plain-english-wording.md). */
function NotWorkingSteps({
  canPause,
  canReplace,
  estateId,
  onPause,
  sensor,
}: {
  canPause: boolean;
  canReplace: boolean;
  estateId: string;
  onPause: () => void;
  sensor: MonitoredSensor;
}) {
  const reason = sameReading(sensor);
  return (
    <div className="grid w-full gap-2">
      {reason ? <p className="text-muted-foreground">{reason}</p> : null}
      {canReplace || canPause ? (
        <div className="flex flex-wrap gap-2">
          {canReplace ? (
            <Link
              className={buttonVariants({ size: "sm" })}
              params={{
                estateId,
                assetId: sensor.assetId,
                deviceId: sensor.deviceId,
              }}
              to="/estates/$estateId/assets/$assetId/devices/$deviceId/replace"
            >
              Replace sensor
            </Link>
          ) : null}
          {canPause ? <PauseButton onPause={onPause} sensor={sensor} /> : null}
        </div>
      ) : (
        <AskSomeoneLine
          action="REPLACE_SENSOR"
          doing="replace this sensor"
          estateId={estateId}
        />
      )}
    </div>
  );
}

function PauseButton({
  onPause,
  sensor,
}: {
  onPause: () => void;
  sensor: MonitoredSensor;
}) {
  return (
    <Button
      aria-label={`Pause warnings for ${sensor.deviceIdentifier} ${metricLabel(sensor.metric).toLowerCase()}`}
      onClick={onPause}
      size="sm"
      variant="outline"
    >
      Pause warnings
    </Button>
  );
}

/** One measurement of a sensor: whether it's working and, when allowed, Pause warnings. */
export function SensorLine({
  sensor,
  canManage,
  canReplace,
  estateId,
  onPause,
}: {
  sensor: MonitoredSensor;
  canManage: boolean;
  /** The reader can replace sensors (estate owner). */
  canReplace: boolean;
  estateId: string;
  onPause: (sensor: MonitoredSensor) => void;
}) {
  const pause = useCallback(() => onPause(sensor), [onPause, sensor]);
  const canPause =
    canManage && sensor.thresholdMinutes !== null && sensor.state !== "PAUSED";
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span>{metricLabel(sensor.metric)}</span>
      <Badge
        className="h-auto whitespace-normal"
        variant={sensor.state === "FLATLINED" ? "destructive" : "secondary"}
      >
        {stateLabel(sensor)}
      </Badge>
      {sensor.state === "FLATLINED" ? (
        <NotWorkingSteps
          canPause={canPause}
          canReplace={canReplace}
          estateId={estateId}
          onPause={pause}
          sensor={sensor}
        />
      ) : null}
      {sensor.state !== "FLATLINED" && canPause ? (
        <PauseButton onPause={pause} sensor={sensor} />
      ) : null}
    </li>
  );
}
