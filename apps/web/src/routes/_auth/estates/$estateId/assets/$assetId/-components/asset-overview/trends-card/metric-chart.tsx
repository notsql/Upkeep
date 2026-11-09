import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@proj/ui/components/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@proj/ui/components/tooltip";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  XAxis,
  YAxis,
} from "@proj/ui/lib/recharts";
import { useCallback, useId, useMemo } from "react";
import { deviceMetrics } from "@/lib/devices";
import {
  formatClock,
  formatDayHour,
  formatMetricNumber,
  localSecondOfDay,
} from "@/lib/format";
import type { MetricSeries, ReadingRange, ReadingSeries } from "@/lib/readings";
import { useMobile } from "@/lib/use-mobile";
import { MetricTooltip } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/metric-tooltip";
import {
  type AnomalyPeriod,
  type ChartRow,
  chartRows,
  coverageNote,
  metricSummary,
  timeTicks,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-data";

const config = {
  avg: { label: "Average", color: "var(--chart-2)" },
  band: { label: "Minimum to maximum", color: "var(--chart-2)" },
} satisfies ChartConfig;

const TICK_STYLE = { fontSize: 12, fill: "var(--muted-foreground)" };

/** Y-axis width from the longest formatted value: chars × 7 px + 8, clamped to 32–64. */
function axisWidth(labels: string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.min(64, Math.max(32, longest * 7 + 8));
}

/** A dot only for a bucket with no neighbours, so one bucket is visible. */
function IsolatedDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (!payload?.isolated || cx === undefined || cy === undefined) {
    return null;
  }
  return <circle cx={cx} cy={cy} fill="var(--color-avg)" r={3} />;
}

function renderDot(props: unknown) {
  const dot = props as {
    cx?: number;
    cy?: number;
    payload?: ChartRow;
    key?: string;
  };
  return <IsolatedDot key={dot.key ?? dot.payload?.t} {...dot} />;
}

function Legend({
  periods,
  series,
}: {
  periods: AnomalyPeriod[];
  series: ReadingSeries;
}) {
  const count = periods.length === 1 ? "1 period" : `${periods.length} periods`;
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="bg-chart-2 size-2 rounded-full" />
        Average
      </span>
      {series.bucketSeconds > 1 ? (
        <span className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="bg-chart-2/20 h-2 w-3 rounded-sm"
          />
          Min–max
        </span>
      ) : null}
      {periods.length ? (
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1" render={<span />}>
            <span
              aria-hidden="true"
              className="bg-destructive/30 h-3 w-2 rounded-sm"
            />
            {`Unusual readings · ${count}`}
          </TooltipTrigger>
          <TooltipContent>"Shaded areas are unusual readings."</TooltipContent>
        </Tooltip>
      ) : null}
    </p>
  );
}

/** The selected metric's chart: avg line, min–max band, anomaly bands; SVG hidden from AT. */
export function MetricChart({
  metric,
  periods,
  phrase,
  range,
  series,
}: {
  metric: MetricSeries;
  periods: AnomalyPeriod[];
  phrase: string;
  range: ReadingRange;
  series: ReadingSeries;
}) {
  const captionId = useId();
  const mobile = useMobile();
  const longRange = series.bucketSeconds >= 300;
  const { name, unit } = deviceMetrics[metric.metric];
  const rows = useMemo(() => chartRows(metric, series), [metric, series]);
  const ticks = useMemo(() => {
    const all = timeTicks(series.from, series.to, range);
    return mobile ? all.filter((_, index) => index % 2 === 0) : all;
  }, [series.from, series.to, range, mobile]);
  const timeTick = useCallback(
    (value: number, index: number) => {
      const instant = new Date(value).toISOString();
      if (range !== "24h") {
        return formatClock(instant);
      }
      return index === 0 || localSecondOfDay(value) === 0
        ? formatDayHour(instant)
        : formatClock(instant);
    },
    [range]
  );
  const valueTick = useCallback(
    (value: number) => formatMetricNumber(metric.metric, value),
    [metric.metric]
  );
  const width = axisWidth(
    metric.points.flatMap((point) => [
      valueTick(point.min),
      valueTick(point.max),
    ])
  );
  const note = coverageNote(metric, series, phrase);
  const thresholdText = periods.length
    ? " Shaded areas are unusual readings."
    : "";
  return (
    <figure aria-labelledby={captionId} className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <figcaption className="text-sm font-medium" id={captionId}>
          <span aria-hidden="true">
            {name} · {unit}
          </span>
          <span className="sr-only">
            {name} ({unit}), {phrase}
          </span>
        </figcaption>
        <Legend periods={periods} series={series} />
      </div>
      <p className="sr-only">
        {metricSummary(metric, periods, longRange)}
        {thresholdText}
      </p>
      <ChartContainer
        aria-hidden="true"
        className="aspect-auto h-48 w-full md:h-64"
        config={config}
      >
        <ComposedChart
          data={rows}
          margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="t"
            domain={[Date.parse(series.from), Date.parse(series.to)]}
            scale="time"
            tick={TICK_STYLE}
            tickFormatter={timeTick}
            tickLine={false}
            ticks={ticks}
            type="number"
          />
          <YAxis
            axisLine={false}
            domain={["auto", "auto"]}
            tick={TICK_STYLE}
            tickCount={4}
            tickFormatter={valueTick}
            tickLine={false}
            width={width}
          />
          {periods.map((period) => (
            <ReferenceArea
              fill="var(--destructive)"
              fillOpacity={0.12}
              ifOverflow="hidden"
              key={period.start}
              stroke="none"
              x1={period.start}
              x2={period.end}
            />
          ))}
          {series.bucketSeconds > 1 ? (
            <Area
              connectNulls={false}
              dataKey="band"
              fill="var(--color-band)"
              fillOpacity={0.2}
              isAnimationActive={false}
              stroke="none"
              type="linear"
            />
          ) : null}
          <Line
            connectNulls={false}
            dataKey="avg"
            dot={renderDot}
            isAnimationActive={false}
            stroke="var(--color-avg)"
            strokeWidth={2}
            type="linear"
          />
          <ChartTooltip
            content={<MetricTooltip metric={metric} series={series} />}
          />
        </ComposedChart>
      </ChartContainer>
      {note ? <p className="text-muted-foreground text-xs">{note}</p> : null}
    </figure>
  );
}
