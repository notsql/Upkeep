import { buttonVariants } from "@proj/ui/components/button";
import { SidebarProvider, SidebarTrigger } from "@proj/ui/components/sidebar";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { AppNavigation, EstateNavigation } from "@/components/app-navigation";
import Header from "@/components/header";

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

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
  if (!signedIn) {
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
      <SidebarProvider>
        <AppNavigation />
        {/* Pages render their own <main>, so the inset is a plain div rather than SidebarInset's <main>. */}
        <div className="bg-background relative flex min-w-0 flex-1 flex-col">
          <Header start={<SidebarTrigger />} />
          <div id="main-content" tabIndex={-1}>
            <EstateNavigation />
            {children}
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}
