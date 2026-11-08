import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { AuthButton } from "@/components/auth/auth-button";
import { HeaderEstateSwitcher } from "@/components/shell/header-estate-switcher";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function Header({
  start,
  brand = true,
}: {
  start?: ReactNode;
  /** False where the sidebar already shows the brand. */
  brand?: boolean;
}) {
  const { user, loading } = useAuth();
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {start}
        {brand ? (
          <nav
            aria-label="Header navigation"
            className="flex items-center gap-5 text-sm"
          >
            <Link className="text-lg font-semibold tracking-tight" to="/">
              UpKeep
            </Link>
          </nav>
        ) : null}
        {user && !loading ? (
          <>
            {brand ? (
              <span aria-hidden="true" className="text-muted-foreground">
                /
              </span>
            ) : null}
            <HeaderEstateSwitcher />
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {user && !loading ? <NotificationBell /> : null}
        <ThemeToggle />
        <AuthButton />
      </div>
    </header>
  );
}
