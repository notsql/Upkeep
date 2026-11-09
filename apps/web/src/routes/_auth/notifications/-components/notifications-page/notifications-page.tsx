import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Bell } from "lucide-react";
import { useCallback, useState } from "react";
import { PageHeader } from "@/components/page/page-header";
import { PageLayout } from "@/components/page/page-layout";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { Pagination } from "@/components/table/pagination";
import {
  NOTIFICATION_PAGE_SIZE,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/notifications";
import { NotificationItem } from "@/routes/_auth/notifications/-components/notifications-page/notification-item";

/** The caller's notifications across the estates they manage (ID-100). */
export function NotificationsPage() {
  const [page, setPage] = useState(0);
  const notifications = useNotifications(page);
  const count = useUnreadNotificationCount(true);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const { mutate: read } = markRead;
  const { mutate: readAll } = markAll;

  const open = useCallback((id: string) => read(id), [read]);
  const readEverything = useCallback(() => readAll(), [readAll]);
  const previous = useCallback(() => setPage((value) => value - 1), []);
  const next = useCallback(() => setPage((value) => value + 1), []);

  const unread = count.data?.unread ?? 0;
  const { data } = notifications;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <PageLayout>
      <PageHeader
        actions={
          <Button
            disabled={unread === 0 || markAll.isPending}
            onClick={readEverything}
            type="button"
            variant="outline"
          >
            Mark all as read
          </Button>
        }
        description="Anomalies, services coming due and predicted repairs in the estates you manage"
        icon={Bell}
        title="Notifications"
      />
      <div className="mt-6 grid gap-4">
        {markAll.error ? (
          <Alert variant="destructive">
            <AlertDescription>{markAll.error.message}</AlertDescription>
          </Alert>
        ) : null}
        <NotificationList
          data={data}
          error={notifications.error}
          onOpen={open}
          onRetry={notifications.refetch}
        />
        {data && data.total > NOTIFICATION_PAGE_SIZE ? (
          <Pagination
            canNext={page + 1 < pages}
            canPrevious={page > 0}
            label="Notification pages"
            onNext={next}
            onPrevious={previous}
            summary={`Page ${page + 1} of ${pages}`}
          />
        ) : null}
      </div>
    </PageLayout>
  );
}

function NotificationList({
  data,
  error,
  onOpen,
  onRetry,
}: {
  data: ReturnType<typeof useNotifications>["data"];
  error: Error | null;
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }
  if (!data) {
    return <LoadingState label="Loading notifications" />;
  }
  if (data.total === 0) {
    return (
      <EmptyState
        description="You'll be told here when an asset needs attention."
        icon={Bell}
        title="No notifications yet"
      />
    );
  }
  return (
    <ul aria-label="Notifications" className="grid gap-2">
      {data.items.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
