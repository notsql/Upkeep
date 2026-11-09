import type { DeviceMetric } from "@/lib/devices";
import {
  type FormatOptions,
  formatDateTime,
  formatDuration,
  formatMetricValue,
  formatTime,
  localSecondOfDay,
} from "@/lib/format";
import type { MetricSeries, ReadingRange, ReadingSeries } from "@/lib/readings";

/** A run of adjacent buckets at or above the API's anomaly threshold. */
export interface AnomalyPeriod {
  end: number;
  maxScore: number;
  start: number;
}

export function anomalyPeriods(series: ReadingSeries): AnomalyPeriod[] {
  const step = series.bucketSeconds * 1000;
  const periods: AnomalyPeriod[] = [];
  for (const bucket of series.anomalies) {
    if (bucket.maxScore < series.anomalyThreshold) {
      continue;
    }
    const start = Date.parse(bucket.start);
    const last = periods.at(-1);
    if (last && last.end === start) {
      last.end = start + step;
      last.maxScore = Math.max(last.maxScore, bucket.maxScore);
    } else {
      periods.push({ start, end: start + step, maxScore: bucket.maxScore });
    }
  }
  return periods;
}

/** One chart row per bucket across the range; missing buckets are null gaps. */
export interface ChartRow {
  avg: number | null;
  band: [number, number] | null;
  /** A point with both neighbouring buckets empty, drawn as a dot. */
  isolated: boolean;
  t: number;
}

/** The requested window and bucket size, as on `ReadingSeries`. */
export interface SeriesWindow {
  bucketSeconds: number;
  from: string;
  to: string;
}

/** Buckets keep the points' phase, from the first at or after `from` to the last before `to`. */
export function chartRows(
  metric: MetricSeries,
  window: SeriesWindow
): ChartRow[] {
  const [first] = metric.points;
  if (!first) {
    return [];
  }
  const step = window.bucketSeconds * 1000;
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const byStart = new Map(
    metric.points.map((point) => [Date.parse(point.start), point])
  );
  const firstStart = Date.parse(first.start);
  const rows: ChartRow[] = [];
  for (
    let t = firstStart - Math.floor((firstStart - from) / step) * step;
    t < to;
    t += step
  ) {
    const point = byStart.get(t);
    rows.push({
      t,
      avg: point?.avg ?? null,
      band: point ? [point.min, point.max] : null,
      isolated: point
        ? !(byStart.has(t - step) || byStart.has(t + step))
        : false,
    });
  }
  return rows;
}

const MIN_BASELINE = 1e-9;

/** First bucket to latest, as a fraction; null without a usable baseline. */
export function percentChange(points: MetricSeries["points"]): number | null {
  const [first] = points;
  const last = points.at(-1);
  if (!(first && last) || points.length < 2) {
    return null;
  }
  if (Math.abs(first.avg) < MIN_BASELINE) {
    return null;
  }
  return (last.avg - first.avg) / Math.abs(first.avg);
}

const TICK_SECONDS: Record<ReadingRange, number> = {
  "1m": 15,
  "15m": 300,
  "1h": 900,
  "24h": 21_600,
};

/** Every UTC offset in use is a multiple of 15 minutes. */
const OFFSET_GRID_SECONDS = 900;

/** X ticks on round local wall times within `[from, to]`. */
export function timeTicks(
  from: string,
  to: string,
  range: ReadingRange,
  options: FormatOptions = {}
): number[] {
  const tick = TICK_SECONDS[range];
  const grid = Math.min(tick, OFFSET_GRID_SECONDS) * 1000;
  const start = Date.parse(from);
  const end = Date.parse(to);
  const ticks: number[] = [];
  for (let t = Math.ceil(start / grid) * grid; t <= end; t += grid) {
    if (localSecondOfDay(t, options) % tick === 0) {
      ticks.push(t);
    }
  }
  return ticks;
}

const COVERAGE_THRESHOLD = 0.1;

/** "Readings cover 5 min of the last 24 hours" when under 10% of buckets have data. */
export function coverageNote(
  metric: MetricSeries,
  window: SeriesWindow,
  phrase: string,
  options: FormatOptions = {}
): string | null {
  const buckets =
    (Date.parse(window.to) - Date.parse(window.from)) /
    (window.bucketSeconds * 1000);
  const filled = metric.points.length;
  if (!filled || filled / buckets >= COVERAGE_THRESHOLD) {
    return null;
  }
  return `Readings cover ${formatDuration(filled * window.bucketSeconds, options)} of the ${phrase}`;
}

function periodText(period: AnomalyPeriod, longRange: boolean): string {
  const format = longRange ? formatDateTime : formatTime;
  const from = format(new Date(period.start).toISOString());
  const to = format(new Date(period.end).toISOString());
  return `Unusual readings from ${from} to ${to}.`;
}

/** The figure's screen-reader summary: latest, range extremes, anomaly periods. */
export function metricSummary(
  metric: MetricSeries,
  periods: AnomalyPeriod[],
  longRange: boolean
): string {
  const name: DeviceMetric = metric.metric;
  const latest = metric.points.at(-1);
  const min = Math.min(...metric.points.map((point) => point.min));
  const max = Math.max(...metric.points.map((point) => point.max));
  const anomalies = periods.length
    ? periods.map((period) => periodText(period, longRange)).join(" ")
    : "No unusual readings.";
  return `Latest ${formatMetricValue(name, latest?.avg ?? 0)}. Minimum ${formatMetricValue(name, min)}, maximum ${formatMetricValue(name, max)}. ${anomalies}`;
}
