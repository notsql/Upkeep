import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { NotificationsPage } from "@/routes/_auth/notifications/-components/notifications-page/notifications-page";

export const Route = createFileRoute("/_auth/notifications/")({
  component: NotificationsPage,
  head: () => pageHead("Notifications"),
});
