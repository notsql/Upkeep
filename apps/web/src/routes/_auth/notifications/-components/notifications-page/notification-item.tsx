import { Badge } from "@proj/ui/components/badge";
import { cn } from "@proj/ui/lib/utils";
import { useCallback } from "react";
import { AlertResponseActions } from "@/components/notifications/alert-response-actions";
import { AlertResponseSummary } from "@/components/notifications/alert-response-summary";
import {
  NotificationRowLink,
  notificationTitle,
} from "@/components/notifications/notification-row-link";
import { UNUSUAL_READINGS_STEP } from "@/components/notifications/unusual-readings-step";
import { formatDateTime } from "@/lib/format";
import {
  formatRelativeTime,
  NOTIFICATION_TYPE_LABELS,
  type Notification,
} from "@/lib/notifications";
import { formatInterval } from "@/lib/service-intervals";
import { badgeVariantFor, notificationTypeTone } from "@/lib/status-tone";
import { NotificationDispatch } from "@/routes/_auth/notifications/-components/notifications-page/notification-dispatch";

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
  return ["Expected repair", chance, source].join(" · ");
}

/** The one-line basis under the summary, for date-driven notifications. */
function basis(notification: Notification): string | undefined {
  const { serviceDue, repairPredicted } = notification;
  if (repairPredicted) {
    return repairBasis(repairPredicted);
  }
  if (serviceDue) {
    return [
      "Based on the service schedule",
      formatInterval(serviceDue.interval),
      INTERVAL_SOURCES[serviceDue.intervalSource],
    ].join(" · ");
  }
}

/** Warnings whose next step is sending crew or a contractor. */
const SEND_STEP_TYPES: ReadonlySet<Notification["type"]> = new Set([
  "SERVICE_DUE",
  "REPAIR_PREDICTED",
  "CHECK_FAILED",
]);

/** One inbox row: opening it marks it read and goes to the asset. */
export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: Notification;
  onOpen: (id: string) => void;
}) {
  const { id, read } = notification;
  const heading = notificationTitle(notification);
  const open = useCallback(() => {
    if (!read) {
      onOpen(id);
    }
  }, [id, onOpen, read]);
  return (
    <li
      className={cn(
        // Hover tints the whole card: the send step and alert actions sit
        // below the link but belong to the same notification.
        "hover:bg-accent/60 rounded-[var(--radius)] border transition-colors",
        read ? "bg-background" : "border-primary/40 bg-accent/40"
      )}
    >
      <NotificationRowLink
        className="focus-visible:ring-ring flex flex-col gap-1 rounded-[var(--radius)] p-4 outline-none focus-visible:ring-2"
        notification={notification}
        onClick={open}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge
            variant={badgeVariantFor(notificationTypeTone[notification.type])}
          >
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </Badge>
          {read ? null : (
            <span className="text-primary text-xs font-semibold">Unread</span>
          )}
          <time
            className="text-muted-foreground ml-auto text-xs"
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt)}
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </div>
        {heading ? (
          <>
            <p className={cn("text-sm", read ? "" : "font-semibold")}>
              {heading}
            </p>
            <p className="text-muted-foreground text-sm">
              {notification.anomaly
                ? `Its readings have been unusual since ${formatDateTime(notification.anomaly.firstDetectedAt)}.`
                : notification.summary}
            </p>
          </>
        ) : (
          <p className={cn("text-sm", read ? "" : "font-semibold")}>
            {notification.summary}
          </p>
        )}
        {basis(notification) ? (
          <p className="text-muted-foreground text-xs">{basis(notification)}</p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {notification.assetName ? (
            <>
              <span>{`${notification.assetName} (${notification.assetReference})`}</span>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span>{notification.estateName}</span>
        </p>
      </NotificationRowLink>
      {SEND_STEP_TYPES.has(notification.type) ? (
        <NotificationDispatch notification={notification} />
      ) : null}
      {notification.anomaly ? (
        <div className="grid gap-2 px-4 pb-4">
          {notification.anomaly.response === "NONE" &&
          !notification.resolvedAt ? (
            <p className="text-sm">{UNUSUAL_READINGS_STEP}</p>
          ) : null}
          <AlertResponseSummary anomaly={notification.anomaly} />
          <AlertResponseActions alert={notification} />
        </div>
      ) : null}
    </li>
  );
}
