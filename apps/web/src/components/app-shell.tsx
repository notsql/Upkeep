import { buttonVariants } from "@proj/ui/components/button";
import { SidebarProvider, SidebarTrigger } from "@proj/ui/components/sidebar";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { type ReactNode, useCallback, useState } from "react";
import {
  AppNavigation,
  EstateNavigation,
  isEstateScoped,
  WorkspaceMenuItems,
} from "@/components/app-navigation";
import { EstateFeatureChooser } from "@/components/estates/estate-feature-chooser";
import type { EstateFeature } from "@/components/estates/estate-feature-switcher";
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

/** The header for pages outside an estate: global links live in the account menu. */
function WorkspaceHeader() {
  const [feature, setFeature] = useState<EstateFeature | undefined>(undefined);
  const changeChooser = useCallback((open: boolean) => {
    if (!open) {
      setFeature(undefined);
    }
  }, []);
  return (
    <>
      <Header menu={<WorkspaceMenuItems onChooseEstate={setFeature} />} />
      {feature ? (
        <EstateFeatureChooser
          feature={feature}
          onOpenChange={changeChooser}
          open
        />
      ) : null}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
  const estateScoped = useRouterState({
    select: (state) => isEstateScoped(state.location.pathname),
  });
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
  if (!estateScoped) {
    return (
      <>
        <SkipLink />
        <WorkspaceHeader />
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
