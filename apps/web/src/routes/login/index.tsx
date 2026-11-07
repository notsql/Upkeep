import { createFileRoute } from "@tanstack/react-router";
import { sanitizeReturnTo } from "@/lib/auth-redirect";
import { pageHead } from "@/lib/page-title";
import { LoginPage } from "@/routes/login/-components/login-page";

interface LoginSearch {
  error?: string;
  returnTo: string;
}

export const Route = createFileRoute("/login/")({
  component: LoginRoute,
  head: () => pageHead("Sign in"),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
    returnTo: sanitizeReturnTo(search.returnTo),
  }),
});

function LoginRoute() {
  const { error, returnTo } = Route.useSearch();
  return <LoginPage error={error} returnTo={returnTo} />;
}
