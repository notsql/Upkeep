import { Badge } from "@proj/ui/components/badge";
import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@proj/ui/components/empty";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { Skeleton } from "@proj/ui/components/skeleton";
import { Switch } from "@proj/ui/components/switch";
import { ToggleGroup } from "@proj/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@proj/ui/components/tooltip";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ChartLine, RefreshCw, Table } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import type { DeviceMetric } from "@/lib/devices";
import { formatTime } from "@/lib/format";
import {
  READING_RANGES,
  type ReadingRange,
  type ReadingSeries,
  useAssetReadingSeries,
} from "@/lib/readings";
import { MetricChart } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/metric-chart";
import { MetricTile } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/metric-tile";
import {
  type AnomalyPeriod,
  anomalyPeriods,
  metricSummary,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-data";

const RANGES = Object.keys(READING_RANGES) as ReadingRange[];
const LIVE_RANGES: ReadingRange[] = ["1m", "15m"];
const LIVE_HINT = "Live is available for 1 min and 15 min";

const RANGE_NAMES: Record<ReadingRange, string> = {
  "1m": "Last 1 minute",
  "15m": "Last 15 minutes",
  "1h": "Last hour",
  "24h": "Last 24 hours",
};

function isRange(value: unknown): value is ReadingRange {
  return RANGES.includes(value as ReadingRange);
}

function LiveToggle({
  allowed,
  checked,
  onCheckedChange,
}: {
  allowed: boolean;
  checked: boolean;
  onCheckedChange: (live: boolean) => void;
}) {
  const switchId = useId();
  const labelId = useId();
  const hintId = useId();
  const control = (
    <>
      <Switch
        aria-describedby={allowed ? undefined : hintId}
        aria-labelledby={labelId}
        checked={checked}
        disabled={!allowed}
        id={switchId}
        onCheckedChange={onCheckedChange}
        size="sm"
      />
      <Label htmlFor={switchId} id={labelId}>
        Live
      </Label>
      {allowed ? null : (
        <span className="sr-only" id={hintId}>
          {LIVE_HINT}
        </span>
      )}
    </>
  );
  if (allowed) {
    return <div className="flex items-center gap-2">{control}</div>;
  }
  return (
    <Tooltip>
      <TooltipTrigger className="flex items-center gap-2" render={<div />}>
        {control}
      </TooltipTrigger>
      <TooltipContent>{LIVE_HINT}</TooltipContent>
    </Tooltip>
  );
}

function TrendsBody({
  data,
  periods,
  phrase,
  range,
}: {
  data: ReadingSeries;
  periods: AnomalyPeriod[];
  phrase: string;
  range: ReadingRange;
}) {
  const [chosen, setChosen] = useState<DeviceMetric | undefined>();
  const summaryPrefix = useId();
  const selected =
    data.metrics.find((metric) => metric.metric === chosen) ?? data.metrics[0];
  const select = useCallback((value: unknown[]) => {
    const [next] = value;
    if (next) {
      setChosen(next as DeviceMetric);
    }
  }, []);
  if (!selected) {
    return null;
  }
  const longRange = data.bucketSeconds >= 300;
  return (
    <>
      {periods.length ? (
        <div>
          <Badge variant="destructive">
            {periods.length === 1
              ? "1 unusual stretch"
              : `${periods.length} unusual stretches`}
          </Badge>
        </div>
      ) : null}
      <ToggleGroup
        aria-label="Measurement"
        className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        onValueChange={select}
        value={[selected.metric]}
      >
        {data.metrics.map((metric) => (
          <MetricTile
            key={metric.metric}
            metric={metric}
            series={data}
            summaryId={`${summaryPrefix}-${metric.metric}`}
          />
        ))}
      </ToggleGroup>
      <div className="sr-only">
        {data.metrics.map((metric) => (
          <p id={`${summaryPrefix}-${metric.metric}`} key={metric.metric}>
            {metricSummary(metric, periods, longRange)}
          </p>
        ))}
      </div>
      <MetricChart
        metric={selected}
        periods={periods}
        phrase={phrase}
        range={range}
        series={data}
      />
    </>
  );
}

/**
 * Headline tiles plus one chart for the selected metric, unboxed under a
 * light toolbar of range, Live and refresh.
 */
export function TrendsCard({
  assetId,
  estateId,
}: {
  assetId: string;
  estateId: string;
}) {
  const [range, setRange] = useState<ReadingRange>("1m");
  const [live, setLive] = useState(false);
  const series = useAssetReadingSeries(estateId, assetId, range, live);
  const rangeLabelId = useId();
  const liveAllowed = LIVE_RANGES.includes(range);
  const { phrase } = READING_RANGES[range];
  const changeRange = useCallback((value: unknown) => {
    if (!isRange(value)) {
      return;
    }
    if (!LIVE_RANGES.includes(value)) {
      setLive(false);
    }
    setRange(value);
  }, []);
  const refetch = useCallback(() => series.refetch(), [series.refetch]);
  const { data } = series;
  const periods = data ? anomalyPeriods(data) : [];
  return (
    <section aria-label="Trends" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="sr-only" id={rangeLabelId}>
          Range
        </span>
        <Select items={RANGE_NAMES} onValueChange={changeRange} value={range}>
          <SelectTrigger aria-labelledby={rangeLabelId} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((value) => (
              <SelectItem key={value} value={value}>
                {RANGE_NAMES[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <LiveToggle
          allowed={liveAllowed}
          checked={live && liveAllowed}
          onCheckedChange={setLive}
        />
        <Button
          aria-label="Refresh trends"
          disabled={series.isFetching}
          onClick={refetch}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn(series.isFetching && "animate-spin")}
          />
        </Button>
        {series.dataUpdatedAt ? (
          <p className="text-muted-foreground text-xs">
            Updated {formatTime(new Date(series.dataUpdatedAt).toISOString())}
          </p>
        ) : null}
        <Link
          className={cn(
            buttonVariants({ size: "sm", variant: "link" }),
            "ml-auto"
          )}
          params={{ estateId, assetId }}
          to="/estates/$estateId/assets/$assetId/readings"
        >
          <Table aria-hidden="true" />
          View as table
        </Link>
      </div>
      {series.isPending ? (
        <div
          aria-busy="true"
          aria-label="Loading trends…"
          className="grid gap-4"
          role="status"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-48 md:h-64" />
        </div>
      ) : null}
      {series.error ? (
        <ErrorState
          message={series.error.message}
          onRetry={refetch}
          retryLabel="Retry trends"
        />
      ) : null}
      {data && !series.error && data.metrics.length === 0 ? (
        <Empty className="gap-2 p-6" role="status">
          <EmptyHeader className="gap-1">
            <EmptyMedia variant="icon">
              <ChartLine aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{`No readings in the ${phrase}`}</EmptyTitle>
            <EmptyDescription className="text-xs">
              Try a longer range.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {data && !series.error && data.metrics.length ? (
        <TrendsBody
          data={data}
          periods={periods}
          phrase={phrase}
          range={range}
        />
      ) : null}
    </section>
  );
}
