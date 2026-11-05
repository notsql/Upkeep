import { Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import type { ReactNode } from "react";
import { useCurrentEstate } from "@/components/app-navigation";
import { AuthButton } from "@/components/auth-button";
import { EstateFeatureSwitcher } from "@/components/estates/estate-feature-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { EstateFeature } from "@/lib/estate-destinations";

const ESTATE_FEATURES = new Set<EstateFeature>([
  "reports",
  "work-orders",
  "documents",
  "readings",
]);

function pathFeature(pathname: string): EstateFeature {
  if (pathname.startsWith("/reports/new")) {
    return "report-creation";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "resident";
  }
  const section = pathname.split("/")[3] as EstateFeature;
  return ESTATE_FEATURES.has(section) ? section : "management";
}

function HeaderEstateSwitcher() {
  const { access, pathname, estateId } = useCurrentEstate();
  const estates = access.data?.estates ?? [];
  return (
    <EstateFeatureSwitcher
      estateId={estateId}
      estates={
        access.data?.canEnterWorkspace
          ? estates
          : estates.filter((estate) => estate.role === "RESIDENT")
      }
      feature={pathFeature(pathname)}
    />
  );
}

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
        <ThemeToggle />
        <AuthButton />
      </div>
    </header>
  );
}
