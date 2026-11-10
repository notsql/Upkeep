import { SidebarProvider } from "@proj/ui/components/sidebar";
import { useIsMobile } from "@proj/ui/hooks/use-mobile";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import {
  AppNavigation,
  hasSidebar,
  isResidentOnly,
} from "@/components/shell/app-navigation";
import { BottomNavigation } from "@/components/shell/bottom-navigation";
import Header from "@/components/shell/header";
import { SidebarHeaderBar } from "@/components/shell/sidebar-header-bar";
import { SkipLink } from "@/components/shell/skip-link";
import { useAppAccess } from "@/lib/access";

function noop() {
  // The desktop sidebar cannot be collapsed.
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
  const mobile = useIsMobile();
  const residentOnly = isResidentOnly(useAppAccess().data);
  const sidebar = useRouterState({
    select: (state) => hasSidebar(state.location.pathname, residentOnly),
  });
  if (!(signedIn && sidebar)) {
    return (
      <>
        <SkipLink />
        <Header />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </>
    );
  }
  return (
    <>
      <SkipLink />
      <SidebarProvider onOpenChange={noop} open>
        {/* On mobile the bottom bar replaces the sidebar sheet. */}
        {mobile ? <BottomNavigation /> : <AppNavigation />}
        {/* Pages render their own <main>, so the inset is a plain div rather than SidebarInset's <main>. */}
        <div className="bg-background relative flex min-w-0 flex-1 flex-col">
          <SidebarHeaderBar />
          <div
            className={
              mobile ? "pb-[calc(7rem+env(safe-area-inset-bottom))]" : undefined
            }
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}
