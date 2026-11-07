import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-title";
import { RegistrationPage } from "@/routes/register/-components/registration-page";

interface RegisterSearch {
  error?: string;
}

export const Route = createFileRoute("/register/")({
  component: RegisterRoute,
  head: () => pageHead("Create an account"),
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

function RegisterRoute() {
  const { error } = Route.useSearch();
  return <RegistrationPage error={error} />;
}
