import { Badge } from "@proj/ui/components/badge";
import { Skeleton } from "@proj/ui/components/skeleton";
import { cn } from "@proj/ui/lib/utils";
import { type StatusTone, statusDotClassName } from "@/lib/status-tone";

/** One secondary source (devices or failure risk) as the rows see it. */
export interface MonitoringSource {
  failed: boolean;
  pending: boolean;
  /** The tone for an asset's value, shown as a dot beside the text. */
  toneFor?: (assetId: string) => StatusTone;
  /** The cell text for an asset, or null for nothing to show. */
  valueFor: (assetId: string) => string | null;
}

/** Devices and risk columns; a column is absent when its source is. */
export interface MonitoringColumns {
  devices?: MonitoringSource;
  risk?: MonitoringSource;
}

export function DeviceSummary({
  assetId,
  source,
}: {
  assetId: string;
  source: MonitoringSource;
}) {
  if (source.pending) {
    return (
      <Skeleton
        aria-label="Loading device summary"
        className="h-4 w-24"
        role="status"
      />
    );
  }
  if (source.failed) {
    return <span className="text-muted-foreground">Unavailable</span>;
  }
  const tone = source.toneFor?.(assetId) ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", statusDotClassName[tone])}
      />
      {source.valueFor(assetId)}
    </span>
  );
}

export function RiskFlag({
  assetId,
  source,
}: {
  assetId: string;
  source: MonitoringSource;
}) {
  if (source.pending) {
    return (
      <Skeleton
        aria-label="Loading failure risk"
        className="h-4 w-20"
        role="status"
      />
    );
  }
  if (source.failed) {
    return <span className="text-muted-foreground">Unavailable</span>;
  }
  const flag = source.valueFor(assetId);
  if (flag) {
    return <Badge variant="destructive">{flag}</Badge>;
  }
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">No risk data</span>
    </span>
  );
}
