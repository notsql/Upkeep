import type { DeviceMetric } from "@/lib/devices";
import { formatDateTime, formatMetricValue } from "@/lib/format";
import type { MetricSeries, ReadingSeries } from "@/lib/readings";

/** Recharts passes `active` and the hovered row's `label` (the bucket start). */
export function MetricTooltip({
  active,
  label,
  metric,
  series,
}: {
  active?: boolean;
  label?: number | string;
  metric: MetricSeries;
  series: ReadingSeries;
}) {
  if (!active || label === undefined) {
    return null;
  }
  const start = new Date(Number(label)).toISOString();
  const point = metric.points.find(
    (candidate) => Date.parse(candidate.start) === Number(label)
  );
  if (!point) {
    return null;
  }
  const anomaly = series.anomalies.find(
    (bucket) => Date.parse(bucket.start) === Number(label)
  );
  const name: DeviceMetric = metric.metric;
  return (
    <div className="bg-background grid gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{formatDateTime(start)}</p>
      <p>Average {formatMetricValue(name, point.avg)}</p>
      <p>Minimum {formatMetricValue(name, point.min)}</p>
      <p>Maximum {formatMetricValue(name, point.max)}</p>
      <p className="text-muted-foreground">
        {point.count === 1 ? "1 sample" : `${point.count} samples`}
      </p>
      {anomaly ? <p>Unusual reading</p> : null}
    </div>
  );
}
