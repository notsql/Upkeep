import { Badge } from "@proj/ui/components/badge";
import { cn } from "@proj/ui/lib/utils";
import { useCallback } from "react";
import {
  NotificationRowLink,
  notificationTitle,
} from "@/components/notifications/notification-row-link";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { formatDateTime } from "@/lib/format";
import {
  formatRelativeTime,
  NOTIFICATION_TYPE_LABELS,
  type Notification,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/notifications";
import { badgeVariantFor, notificationTypeTone } from "@/lib/status-tone";

/** How many notifications the bell's dropdown shows before "View all". */
export const RECENT_NOTIFICATION_COUNT = 5;

/**
 * The bell dropdown's list: the newest few notifications, read from the
 * inbox's first page so both share one cache. Opening one marks it read.
 */
export function RecentNotifications({ onOpen }: { onOpen: () => void }) {
  const notifications = useNotifications(0);
  const markRead = useMarkNotificationRead();
  const retry = useCallback(
    () => notifications.refetch(),
    [notifications.refetch]
  );
  if (notifications.isPending) {
    return (
      <div className="p-4">
        <LoadingState label="Loading notifications…" rows={2} />
      </div>
    );
  }
  if (notifications.error) {
    return (
      <div className="p-4">
        <ErrorState message={notifications.error.message} onRetry={retry} />
      </div>
    );
  }
  const recent = notifications.data.items.slice(0, RECENT_NOTIFICATION_COUNT);
  if (recent.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center text-sm">
        No notifications yet
      </p>
    );
  }
  return (
    <ul
      aria-label="Recent notifications"
      className="max-h-[min(28rem,70vh)] divide-y overflow-y-auto"
    >
      {recent.map((notification) => (
        <RecentNotification
          key={notification.id}
          notification={notification}
          onOpen={onOpen}
          onRead={markRead.mutate}
        />
      ))}
    </ul>
  );
}

function RecentNotification({
  notification,
  onOpen,
  onRead,
}: {
  notification: Notification;
  onOpen: () => void;
  onRead: (id: string) => void;
}) {
  const { id, read } = notification;
  const open = useCallback(() => {
    if (!read) {
      onRead(id);
    }
    onOpen();
  }, [id, onOpen, onRead, read]);
  return (
    <li className={cn(read ? "" : "bg-accent/40")}>
      <NotificationRowLink
        className="hover:bg-accent/60 focus-visible:ring-ring flex flex-col gap-1 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        notification={notification}
        onClick={open}
      >
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            variant={badgeVariantFor(notificationTypeTone[notification.type])}
          >
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </Badge>
          {read ? null : (
            <span className="text-primary font-semibold">Unread</span>
          )}
          <time
            className="text-muted-foreground ml-auto"
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt)}
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </span>
        <span
          className={cn("line-clamp-2 text-sm", read ? "" : "font-semibold")}
        >
          {notificationTitle(notification) ?? notification.summary}
        </span>
        {notification.assetName ? (
          <span className="text-muted-foreground truncate text-xs">
            {`${notification.assetName} (${notification.assetReference}) · ${notification.estateName}`}
          </span>
        ) : (
          <span className="text-muted-foreground truncate text-xs">
            {notification.estateName}
          </span>
        )}
      </NotificationRowLink>
    </li>
  );
}
