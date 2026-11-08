import { Badge } from "@proj/ui/components/badge";
import { cn } from "@proj/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { AlertResponseActions } from "@/components/notifications/alert-response-actions";
import { AlertResponseSummary } from "@/components/notifications/alert-response-summary";
import {
  formatRelativeTime,
  NOTIFICATION_TYPE_LABELS,
  type Notification,
} from "@/lib/notifications";
import { formatInterval } from "@/lib/service-intervals";

const INTERVAL_SOURCES = {
  ASSET: "Set on this asset",
  CATEGORY: "Manufacturer interval for the category",
  // The server never raises a service-due notification without an interval.
  NONE: "No interval",
} as const;

// The server never raises a prediction beyond 90 days; it is listed for completeness.
const WINDOWS = {
  WITHIN_30_DAYS: "within 30 days",
  WITHIN_60_DAYS: "within 60 days",
  WITHIN_90_DAYS: "within 90 days",
  BEYOND_90_DAYS: "beyond 90 days",
} as const;

type RepairPredicted = NonNullable<Notification["repairPredicted"]>;

function repairBasis(prediction: RepairPredicted): string {
  const chance = `${Math.round(prediction.probability * 100)}% chance ${WINDOWS[prediction.recommendedTimeframe]}`;
  const repairs = prediction.failuresObserved === 1 ? "repair" : "repairs";
  const source =
    prediction.basis === "ASSET_HISTORY"
      ? `based on ${prediction.failuresObserved} recorded ${repairs}`
      : "based on typical pumps; no repairs recorded yet";
  return ["Prediction", chance, source].join(" · ");
}

/** The one-line basis under the summary, for date-driven notifications. */
function basis(notification: Notification): string | undefined {
  const { serviceDue, repairPredicted } = notification;
  if (repairPredicted) {
    return repairBasis(repairPredicted);
  }
  if (serviceDue) {
    return [
      "Interval-based, not a prediction",
      formatInterval(serviceDue.interval),
      INTERVAL_SOURCES[serviceDue.intervalSource],
    ].join(" · ");
  }
}

/** One inbox row: opening it marks it read and goes to the asset. */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (id: string) => void;
}) {
  const { id, read } = notification;
  const open = useCallback(() => {
    if (!read) {
      onOpen(id);
    }
  }, [id, onOpen, read]);
  return (
    <li
      className={cn(
        "rounded-[var(--radius)] border transition-colors",
        read ? "bg-background" : "border-primary/40 bg-accent/40"
      )}
    >
      <Link
        className="hover:bg-accent/60 focus-visible:ring-ring flex flex-col gap-1 rounded-[var(--radius)] p-4 outline-none focus-visible:ring-2"
        onClick={open}
        params={{
          estateId: notification.estateId,
          assetId: notification.assetId,
        }}
        to="/estates/$estateId/assets/$assetId"
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={read ? "outline" : "default"}>
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </Badge>
          {read ? null : (
            <span className="text-primary text-xs font-semibold">Unread</span>
          )}
          <time
            className="text-muted-foreground ml-auto text-xs"
            dateTime={notification.createdAt}
            title={new Date(notification.createdAt).toLocaleString()}
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </div>
        <p className={cn("text-sm", read ? "" : "font-semibold")}>
          {notification.summary}
        </p>
        {basis(notification) ? (
          <p className="text-muted-foreground text-xs">{basis(notification)}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          <span>{`${notification.assetName} (${notification.assetReference})`}</span>
          <span aria-hidden="true"> · </span>
          <span>{notification.estateName}</span>
        </p>
      </Link>
      {notification.anomaly ? (
        <div className="grid gap-2 px-4 pb-4">
          <AlertResponseSummary anomaly={notification.anomaly} />
          <AlertResponseActions alert={notification} />
        </div>
      ) : null}
    </li>
  );
}
