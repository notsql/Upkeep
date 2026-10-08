import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";
import Header from "@/components/header";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const signedIn = Boolean(user) && !loading;
  return (
    <div className={signedIn ? "app-shell" : "public-shell"}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {signedIn ? <AppNavigation /> : null}
      <div className="app-workspace">
        <Header />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
