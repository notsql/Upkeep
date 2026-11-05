import { buttonVariants } from "@proj/ui/components/button";
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@proj/ui/components/sidebar";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import {
  AppNavigation,
  hasSidebar,
  isResidentOnly,
} from "@/components/app-navigation";
import Header from "@/components/header";
import { useAppAccess } from "@/lib/access";

function SkipLink() {
  return (
    <a
      className={buttonVariants({
        className:
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50",
      })}
      href="#main-content"
    >
      Skip to content
    </a>
  );
}

/** The sidebar stays open on desktop; only the mobile sheet needs a trigger and the brand. */
function SidebarHeaderBar() {
  const { isMobile } = useSidebar();
  return (
    <Header brand={isMobile} start={isMobile ? <SidebarTrigger /> : null} />
  );
}

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
