import { env } from "@proj/env/web";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { getCurrentReturnTo } from "@/lib/auth-redirect";
import { AuthGuard } from "@/routes/-components/auth-guard";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  if (!env.VITE_WORKOS_CLIENT_ID) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <p className="text-destructive text-sm" role="alert">
          Authentication is not configured. Please contact support.
        </p>
      </main>
    );
  }

  return (
    <AuthGuard returnTo={getCurrentReturnTo()}>
      <Outlet />
    </AuthGuard>
  );
}
