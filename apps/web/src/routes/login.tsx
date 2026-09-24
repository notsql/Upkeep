import { env } from "@proj/env/web";
import { createFileRoute } from "@tanstack/react-router";

import { sanitizeReturnTo } from "@/lib/auth-redirect";
import { AuthKitLogin } from "@/routes/-components/auth-kit-login";

interface LoginSearch {
  returnTo: string;
}

export const Route = createFileRoute("/login")({
  component: LoginRoute,
  head: () => ({ meta: [{ title: "Sign in" }] }),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    returnTo: sanitizeReturnTo(search.returnTo),
  }),
});

function LoginRoute() {
  const { returnTo } = Route.useSearch();
  return <LoginPage returnTo={returnTo} />;
}

export function LoginPage({ returnTo = "/" }: { returnTo?: string }) {
  return (
    <main className="flex items-center justify-center px-4 py-12">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm sm:p-8"
      >
        <h1 className="font-semibold text-2xl" id="login-heading">
          Sign in
        </h1>
        <div className="mt-6">
          {env.VITE_WORKOS_CLIENT_ID ? (
            <AuthKitLogin returnTo={sanitizeReturnTo(returnTo)} />
          ) : (
            <p className="text-destructive text-sm" role="alert">
              Sign in is not configured. Please contact support.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
