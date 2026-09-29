import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { buttonVariants } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";

import { buildSignInPath, sanitizeReturnTo } from "@/lib/auth-redirect";

interface LoginSearch {
  error?: string;
  returnTo: string;
}

export const Route = createFileRoute("/login/")({
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
      <Card
        aria-labelledby="login-heading"
        className="w-full max-w-md"
        role="region"
      >
        <CardHeader>
          <CardTitle>
            <h1 className="font-semibold text-2xl" id="login-heading">
              Sign in
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error === "auth_unavailable"
                  ? "Authentication is temporarily unavailable. Please try again."
                  : "Authentication failed or expired. Please try again."}
              </AlertDescription>
            </Alert>
          ) : null}
          <a
            className={buttonVariants({ className: "w-full", size: "lg" })}
            href={buildSignInPath(returnTo)}
          >
            Continue to secure sign in
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
