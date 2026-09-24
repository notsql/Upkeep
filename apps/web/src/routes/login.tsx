import { createFileRoute } from "@tanstack/react-router";

import { buildSignInPath, sanitizeReturnTo } from "@/lib/auth-redirect";

interface LoginSearch {
  error?: string;
  returnTo: string;
}

export const Route = createFileRoute("/login")({
  component: LoginRoute,
  head: () => ({ meta: [{ title: "Sign in" }] }),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
    returnTo: sanitizeReturnTo(search.returnTo),
  }),
});

function LoginRoute() {
  const { error, returnTo } = Route.useSearch();
  return <LoginPage error={error} returnTo={returnTo} />;
}

export function LoginPage({
  error,
  returnTo = "/",
}: {
  error?: string;
  returnTo?: string;
}) {
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
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error === "auth_unavailable"
                ? "Authentication is temporarily unavailable. Please try again."
                : "Authentication failed or expired. Please try again."}
            </p>
          ) : null}
          <a
            className="mt-4 inline-flex h-10 w-full items-center justify-center bg-primary px-4 font-medium text-primary-foreground text-sm hover:bg-primary/80"
            href={buildSignInPath(returnTo)}
          >
            Continue to secure sign in
          </a>
        </div>
      </section>
    </main>
  );
}
