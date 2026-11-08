import { Badge } from "@proj/ui/components/badge";
import { Skeleton } from "@proj/ui/components/skeleton";

/** One secondary source (devices or failure risk) as the rows see it. */
export interface MonitoringSource {
  failed: boolean;
  pending: boolean;
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
  return <span>{source.valueFor(assetId)}</span>;
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
  return flag ? <Badge variant="destructive">{flag}</Badge> : null;
}
