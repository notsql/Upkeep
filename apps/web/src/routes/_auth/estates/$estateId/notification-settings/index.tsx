import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NotificationSettingsPage } from "@/routes/_auth/estates/$estateId/notification-settings/-components/notification-settings-page/notification-settings-page";

export const Route = createFileRoute(
  "/_auth/estates/$estateId/notification-settings/"
)({
  component: NotificationSettingsRoute,
  head: () => pageHead("Notification settings"),
});

function NotificationSettingsRoute() {
  const { estateId } = Route.useParams();
  return <NotificationSettingsPage estateId={estateId} />;
}
