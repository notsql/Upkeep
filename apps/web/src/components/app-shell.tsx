import { SidebarProvider } from "@proj/ui/components/sidebar";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import {
  AppNavigation,
  hasSidebar,
  isResidentOnly,
} from "@/components/app-navigation";
import Header from "@/components/header";
import { SidebarHeaderBar } from "@/components/sidebar-header-bar";
import { SkipLink } from "@/components/skip-link";
import { useAppAccess } from "@/lib/access";

function noop() {
  // The desktop sidebar cannot be collapsed.
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
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
        <AppNavigation />
        {/* Pages render their own <main>, so the inset is a plain div rather than SidebarInset's <main>. */}
        <div className="bg-background relative flex min-w-0 flex-1 flex-col">
          <SidebarHeaderBar />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}
