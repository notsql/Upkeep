import { ToggleGroupItem } from "@proj/ui/components/toggle-group";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { deviceMetrics } from "@/lib/devices";
import { formatMetricValue, formatPercent, formatTime } from "@/lib/format";
import type { MetricSeries, ReadingSeries } from "@/lib/readings";
import { Sparkline } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/sparkline";
import {
  chartRows,
  percentChange,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-data";

function changeWords(change: number | null, since: string): string {
  if (change === null) {
    return "no change available";
  }
  if (change === 0) {
    return `no change since ${since}`;
  }
  const direction = change > 0 ? "up" : "down";
  return `${direction} ${formatPercent(Math.abs(change))} since ${since}`;
}

function ChangeIcon({ change }: { change: number }) {
  if (change > 0) {
    return <ArrowUp aria-hidden="true" className="size-3" />;
  }
  if (change < 0) {
    return <ArrowDown aria-hidden="true" className="size-3" />;
  }
  return <Minus aria-hidden="true" className="size-3" />;
}

/**
 * One metric's headline: latest avg, change since the range's first bucket
 * (muted, never status-coloured) and a sparkline. A ToggleGroup item.
 */
export function MetricTile({
  metric,
  series,
  summaryId,
}: {
  metric: MetricSeries;
  series: ReadingSeries;
  summaryId: string;
}) {
  const { name } = deviceMetrics[metric.metric];
  const latest = metric.points.at(-1);
  const value = latest ? formatMetricValue(metric.metric, latest.avg) : "—";
  const change = percentChange(metric.points);
  const since = formatTime(metric.points[0]?.start ?? series.from);
  return (
    <ToggleGroupItem
      aria-describedby={summaryId}
      aria-label={`${name}, ${value}, ${changeWords(change, since)}`}
      className="bg-card aria-pressed:ring-ring h-auto min-w-0 flex-col items-stretch gap-1 rounded-xl border p-3 text-left whitespace-normal aria-pressed:ring-2"
      value={metric.metric}
    >
      <span className="text-muted-foreground text-xs">{name}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {change === null ? (
        <span
          aria-label="No change available"
          className="text-muted-foreground text-xs"
          role="img"
        >
          —
        </span>
      ) : (
        <span className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs tabular-nums">
          <ChangeIcon change={change} />
          {formatPercent(change, { signed: true })}
        </span>
      )}
      <Sparkline rows={chartRows(metric, series)} />
    </ToggleGroupItem>
  );
}
