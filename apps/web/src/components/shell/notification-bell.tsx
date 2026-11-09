import { buttonVariants } from "@proj/ui/components/button";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useAppAccess } from "@/lib/access";
import { useUnreadNotificationCount } from "@/lib/notifications";

const BADGE_CAP = 99;

/**
 * The header's link to /notifications, shown to users who manage an estate
 * (ID-100) and to crew, who can be sent to inspect.
 */
export function NotificationBell() {
  const access = useAppAccess();
  const manages =
    access.data?.estates.some(
      (estate) => estate.role === "MANAGER" || estate.role === "CREW"
    ) ?? false;
  const count = useUnreadNotificationCount(manages);
  if (!manages) {
    return null;
  }
  const unread = count.data?.unread ?? 0;
  const label =
    unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Link
      aria-label={label}
      className={buttonVariants({
        variant: "ghost",
        size: "icon",
        className: "relative",
      })}
      title={label}
      to="/notifications"
    >
      <Bell aria-hidden="true" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-semibold"
        >
          {unread > BADGE_CAP ? `${BADGE_CAP}+` : String(unread)}
        </span>
      ) : null}
    </Link>
  );
}
