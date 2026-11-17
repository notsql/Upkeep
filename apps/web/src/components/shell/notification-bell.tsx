import { Button, buttonVariants } from "@proj/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@proj/ui/components/popover";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useState } from "react";
import { RecentNotifications } from "@/components/shell/recent-notifications";
import { useAppAccess } from "@/lib/access";
import { useUnreadNotificationCount } from "@/lib/notifications";

const BADGE_CAP = 99;

/**
 * The header's notification button, shown to users who manage an estate
 * (ID-100) and to crew, who can be sent to inspect. It opens a dropdown of
 * the most recent notifications, with a link to the full inbox.
 */
export function NotificationBell() {
  const access = useAppAccess();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
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
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={label}
        render={<Button className="relative" size="icon" variant="ghost" />}
        title={label}
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
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        {open ? <RecentNotifications onOpen={close} /> : null}
        <div className="border-t p-2">
          <Link
            className={buttonVariants({
              variant: "ghost",
              className: "w-full",
            })}
            onClick={close}
            to="/notifications"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
